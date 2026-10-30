import { UniqueConstraintError } from "sequelize";
import { Env } from "../../config/env.config";
import { hashDeviceKey, isSameDevice } from "../../helpers/deviceKey.helper";
import { MINUTE_MS, callName, liveStatus, mintToken, opensAt, scheduleOf } from "../../helpers/meeting.helper";
import { maskEmail } from "../../helpers/speech.helper";
import { trace, traceFailure } from "../../helpers/trace.helper";
import { IAcsIdentity } from "../../interfaces/IAcs.interface";
import {
    IGuestRegistered,
    IGuestRegistration,
    IMeetingAgentHandoff,
    IMeetingJoinCredentials,
    IMeetingLobbyEntry,
    MeetingAcsRole,
    MeetingRole,
} from "../../interfaces/IMeeting.interface";
import MeetingParticipant from "../../models/meetingParticipant.model";
import MeetingSession from "../../models/meetingSession.model";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import * as vaRepo from "../../repositories/meeting/vaSchedule.repository";
import {
    emitAdmission,
    emitLobbyWaiting,
    emitParticipantJoined,
    emitParticipantLeft,
} from "../../sockets/virtualAvatar.socket";
import * as acs from "../acs/acs.service";
import * as interviewCalls from "../interview/interviewCall.service";
import * as workable from "../workable/workable.service";
import * as recording from "./meetingRecording.service";
import { acsRoleFor, entersLobby, locksToOneDevice, resolveRole } from "./meetingRole.service";
import { recordEvent, recordFailure, scopeOfMeeting } from "./meetingHistory.service";
import { endAfterSubmission } from "./meetingSession.service";

const ROLES_THAT_FAIL_THE_CALL_WHEN_DECLINED = new Set(["CANDIDATE", "AGENT"]);

const recordDeclined = async (
    meeting: MeetingSession,
    participant: MeetingParticipant,
    code: "JOIN_REJECTED" | "LOBBY_TIMEOUT",
    reason: string,
): Promise<void> => {
    if (!ROLES_THAT_FAIL_THE_CALL_WHEN_DECLINED.has(participant.role)) return;

    await interviewCalls.recordOpenCallFailure(Number(meeting.company_id), Number(meeting.meeting_session_id), {
        code,
        reason,
        stage: "admission",
        declined: true,
    });
};

const seatsRemaining = (meeting: MeetingSession): number =>
    Math.max(meeting.max_participants - meeting.joined_count, 0);

export const assertJoinable = (meeting: MeetingSession): void => {
    const status = liveStatus(meeting);

    if (status === "REVOKED") throw new Error("Conflict: this link has been revoked");
    if (status === "CANCELLED") throw new Error("Conflict: this session has been cancelled");
    if (status === "ENDED" || status === "EXPIRED") {
        throw new Error("Conflict: this session has already ended");
    }
    if (status === "SCHEDULED") {
        throw new Error(`Conflict: this session opens at ${opensAt(scheduleOf(meeting)).toISOString()}`);
    }
    if (!meeting.room_id) throw new Error("Conflict: this session has no room yet");
};

/* one browser per candidate */

export const IN_USE_ELSEWHERE =
    "Conflict: This interview link is already in use or has an active session. " +
    "Please return to your original browser or contact your interviewer for assistance.";

const inUseSessionLink = (participant: MeetingParticipant | null, deviceKey: string | null): boolean =>
    Boolean(
        participant &&
            locksToOneDevice(participant.role) &&
            participant.device_key_hash &&
            !isSameDevice(participant.device_key_hash, deviceKey),
    );

const assertSameDevice = (participant: MeetingParticipant, deviceKey: string | null): void => {
    if (inUseSessionLink(participant, deviceKey)) throw new Error(IN_USE_ELSEWHERE);
};

const claimDevice = async (
    meeting: MeetingSession,
    participant: MeetingParticipant,
    deviceKey: string,
): Promise<void> => {
    if (!locksToOneDevice(participant.role)) return;

    if (!participant.device_key_hash) {
        if (await meetingRepo.bindDevice(participant, hashDeviceKey(deviceKey))) {
            trace("meeting", meeting.uuid, "device_bound", {
                participantId: Number(participant.meeting_participant_id),
            });
            return;
        }
    }

    if (inUseSessionLink(participant, deviceKey)) {
        trace("meeting", meeting.uuid, "device_rejected", {
            participantId: Number(participant.meeting_participant_id),
        });
        throw new Error(IN_USE_ELSEWHERE);
    }
};

const assertNotCompleted = async (meeting: MeetingSession, participant: MeetingParticipant): Promise<void> => {
    if (!locksToOneDevice(participant.role)) return;

    const booking = await vaRepo.findByMeeting(Number(meeting.meeting_session_id));
    if (booking?.meeting_status === "COMPLETED") {
        throw new Error("Conflict: This interview has already been completed");
    }
};

export const requireInvite = async (
    ref: string,
): Promise<{ meeting: MeetingSession; participant: MeetingParticipant | null }> => {
    const participant = await meetingRepo.findBySessionToken(ref);

    if (participant) {
        const meeting = await meetingRepo.findById(participant.meeting_session_id);
        if (!meeting) throw new Error("No session for this link");
        return { meeting, participant };
    }

    const meeting = await meetingRepo.findByPublicToken(ref);
    if (meeting) return { meeting, participant: null };

    throw new Error("No session for this link");
};

export const requireOrganiser = async (
    organiserRef: string,
    reference?: string,
): Promise<{ meeting: MeetingSession; organiser: MeetingParticipant }> => {
    const { meeting, participant } = await requireInvite(organiserRef);

    if (reference && meeting.uuid !== reference) {
        throw new Error("Conflict: that link is not for this session");
    }
    if (participant?.role !== "ORGANIZER" || participant.admission_state !== "ADMITTED") {
        throw new Error("Conflict: only an organizer in the call can do this");
    }
    return { meeting, organiser: participant };
};

const guestRegistered = (
    meeting: MeetingSession,
    guest: MeetingParticipant,
): IGuestRegistered => ({
    guestRef: guest.session_token,
    participantId: Number(guest.meeting_participant_id),
    sessionReference: meeting.uuid,
    displayName: callName(guest),
    role: guest.role,
});

const createGuest = async (
    meeting: MeetingSession,
    input: IGuestRegistration,
    role: MeetingRole,
): Promise<MeetingParticipant> => {
    const sessionToken = mintToken();

    try {
        return await meetingRepo.createParticipant({
            meetingSessionId: meeting.meeting_session_id,
            roomId: meeting.room_id,
            email: input.email,
            displayName: input.displayName,
            role,
            candidateId: null,
            sessionToken,
            sessionLink: `${Env.virtualAvatar.VA_JOIN_BASE_URL}?ref=${sessionToken}`,
        });
    } catch (error) {
        if (!(error instanceof UniqueConstraintError)) throw error;
        const raced = await meetingRepo.findParticipantByEmail(meeting.meeting_session_id, input.email);
        if (!raced) throw error;
        return raced;
    }
};

/** The guest link is forwarded on by the organiser, so the one thing we can check is that the address is one of ours. */
const assertRegistered = async (email: string, meeting: MeetingSession): Promise<void> => {
    const reference = meeting.uuid;
    const scope = scopeOfMeeting(meeting);

    const members = await workable.findMembersByEmail(email).catch(async (error) => {
        traceFailure("meeting", reference, "guest_lookup", error);
        await recordFailure(
            scope,
            {
                track: "PARTICIPANT_ADMISSION",
                provider: "WORKABLE",
                eventType: "GUEST_LOOKUP_FAILED",
                message: "A guest could not be checked against the registered members",
                details: { email },
            },
            error,
        );
        throw new Error(
            "Unavailable: Email verification is unavailable right now, please contact the administrator",
        );
    });

    if (!members.some((member) => member.email?.trim().toLowerCase() === email && member.active !== false)) {
        trace("meeting", reference, "guest_rejected", { email });
        await recordFailure(
            scope,
            {
                track: "PARTICIPANT_ADMISSION",
                provider: "WORKABLE",
                eventType: "GUEST_REJECTED",
                toStatus: "REJECTED",
                message: "A guest was turned away because their email is not registered",
                details: { email },
                errorCode: "GUEST_NOT_REGISTERED",
            },
            new Error("The email address is not registered"),
        );
        throw new Error(
            "Conflict: The email address is not registered with us, please contact the administrator",
        );
    }
};

export const registerGuest = async (input: IGuestRegistration): Promise<IGuestRegistered> => {
    const { meeting, participant } = await requireInvite(input.ref);
    if (participant) throw new Error("Conflict: this is a personal link, open it directly");
    assertJoinable(meeting);

    // A staff address on the organiser domain is an organiser wherever it arrives from.
    const role = resolveRole(input.email) === "ORGANIZER" ? "ORGANIZER" : "GUEST";

    const existing = await meetingRepo.findParticipantByEmail(meeting.meeting_session_id, input.email);
    if (existing && existing.role !== role) {
        throw new Error("Conflict: that email already has its own invite link, use that one");
    }

    // Only a guest is checked against Workable; the organiser domain is its own proof.
    if (!existing && role === "GUEST") await assertRegistered(input.email, meeting);

    const guest = existing ?? (await createGuest(meeting, input, role));

    trace("meeting", meeting.uuid, "guest_registered", {
        participantId: Number(guest.meeting_participant_id),
        role: guest.role,
        rejoin: Boolean(existing),
    });
    await recordEvent(scopeOfMeeting(meeting), {
        track: "PARTICIPANT_ADMISSION",
        provider: "SYSTEM",
        eventType: "GUEST_REGISTERED",
        toStatus: "REGISTERED",
        message: existing ? "A guest returned with their registered details" : "A guest registered to join",
        details: {
            participantId: Number(guest.meeting_participant_id),
            role: guest.role,
            rejoin: Boolean(existing),
            email: guest.email,
        },
    });

    return guestRegistered(meeting, guest);
};

const credentials = (
    meeting: MeetingSession,
    participant: MeetingParticipant,
    identity: IAcsIdentity,
    acsRole: MeetingAcsRole,
): IMeetingJoinCredentials => ({
    participantId: Number(participant.meeting_participant_id),
    sessionReference: meeting.uuid,
    displayName: callName(participant),
    role: participant.role,
    acsRole,
    acsEndpoint: Env.acs.ACS_ENDPOINT,
    roomId: meeting.room_id!,
    chatThreadId: meeting.acs_chat_thread_id,
    communicationUserId: identity.communicationUserId,
    acsToken: identity.token,
    acsTokenExpiresOn: identity.expiresOn.toISOString(),
    roomValidUntil: scheduleOf(meeting).endsAt.toISOString(),
});

const credentialsFor = async (
    meeting: MeetingSession,
    participant: MeetingParticipant,
): Promise<IMeetingJoinCredentials> => {
    if (!participant.acs_user_id) {
        throw new Error("Conflict: this participant has no ACS identity yet");
    }

    const identity = await acs.issueTokenFor(participant.acs_user_id);
    return credentials(meeting, participant, identity, participant.acs_role ?? acsRoleFor(participant.role));
};

const provision = async (
    meeting: MeetingSession,
    participant: MeetingParticipant,
    admittedBy: number | null = null,
): Promise<IMeetingJoinCredentials> => {
    const scope = scopeOfMeeting(meeting);

    await meetingRepo.reserveSeat(meeting.meeting_session_id, participant.meeting_participant_id);
    await participant.reload();

    try {
        const identity = await acs.createUserAndToken();
        const acsRole = acsRoleFor(participant.role);

        await acs.addRoomParticipant(meeting.room_id!, identity.communicationUserId, acsRole);

        if (meeting.acs_chat_thread_id && meeting.owner_acs_user_id) {
            const owner = await acs.issueTokenFor(meeting.owner_acs_user_id);
            await acs
                .addChatParticipant(
                    owner.token,
                    meeting.acs_chat_thread_id,
                    identity.communicationUserId,
                    callName(participant),
                )
                .catch(async (error) => {
                    traceFailure("meeting", meeting.uuid, "chat-add", error);
                    await recordFailure(
                        scope,
                        {
                            track: "AZURE_CALLING",
                            provider: "ACS",
                            eventType: "CHAT_PARTICIPANT_ADD_FAILED",
                            message: "A participant could not be added to the meeting chat",
                            details: { participantId: Number(participant.meeting_participant_id), role: participant.role },
                        },
                        error,
                    );
                });
        }

        await meetingRepo.completeSeat(participant, {
            acsUserId: identity.communicationUserId,
            acsRole,
        });
        await meetingRepo.markFirstJoin(meeting);

        void recording.startForMeeting(meeting);

        trace("meeting", meeting.uuid, "admitted", {
            participantId: Number(participant.meeting_participant_id),
            role: participant.role,
            seat: participant.seat_no,
        });
        await recordEvent(scope, {
            track: "PARTICIPANT_ADMISSION",
            provider: "ACS",
            eventType: "PARTICIPANT_ADMITTED",
            toStatus: "ADMITTED",
            actor: admittedBy === null ? { type: "SYSTEM", id: null } : { type: "PARTICIPANT", id: admittedBy },
            message: `${callName(participant)} was admitted to the call`,
            details: {
                participantId: Number(participant.meeting_participant_id),
                role: participant.role,
                seat: participant.seat_no,
                acsRole,
            },
        });

        emitParticipantJoined(meeting.uuid, {
            participantId: Number(participant.meeting_participant_id),
            displayName: callName(participant),
            role: participant.role,
        });

        return credentials(meeting, participant, identity, acsRole);
    } catch (error) {
        await meetingRepo.releaseSeat(participant).catch(() => undefined);
        await recordFailure(
            scope,
            {
                track: "AZURE_CALLING",
                provider: "ACS",
                eventType: "PARTICIPANT_PROVISION_FAILED",
                toStatus: "SEAT_RELEASED",
                message: `${callName(participant)} could not be admitted to the call`,
                details: { participantId: Number(participant.meeting_participant_id), role: participant.role },
            },
            error,
        );
        throw error;
    }
};

const lobbyEntry = (participant: MeetingParticipant): IMeetingLobbyEntry => ({
    participantId: Number(participant.meeting_participant_id),
    displayName: callName(participant),
    emailMasked: maskEmail(participant.email),
    role: participant.role,
    requestedAt: (participant.updated_at ?? participant.created_at).toISOString(),
});

export const preflight = async (ref: string, deviceKey: string | null) => {
    const { meeting, participant } = await requireInvite(ref);
    const status = liveStatus(meeting);
    const schedule = scheduleOf(meeting);
    const role = participant?.role ?? "GUEST";

    return {
        sessionReference: meeting.uuid,
        topic: meeting.topic,
        sessionStatus: status,
        joinable: status === "ACTIVE",
        displayName: callName(participant),
        role,
        entersLobby: entersLobby(role),
        seatsRemaining: seatsRemaining(meeting),
        expiresAt: schedule.endsAt.toISOString(),
        recordingRequested: meeting.recording_requested,
        startsAt: schedule.startsAt.toISOString(),
        opensAt: opensAt(schedule).toISOString(),
        notYetOpen: status === "SCHEDULED",
        requiresGuestDetails: participant === null,
        inUseSessionLink: inUseSessionLink(participant, deviceKey),
    };
};

export const listParticipants = async (ref: string) => {
    const { meeting } = await requireInvite(ref);
    const participants = await meetingRepo.findParticipants(meeting.meeting_session_id);

    return participants.map((participant) => ({
        participantId: Number(participant.meeting_participant_id),
        name: participant.display_name ?? participant.email,
        email: participant.email,
        role: participant.role,
        acsUserId: participant.acs_user_id,
        admissionState: participant.admission_state,
        emailStatus: participant.email_status,
    }));
};

const ROLES_THAT_MAY_SHARE_LINK = new Set(["ORGANIZER", "GUEST"]);

export const publicLinkFor = async (ref: string): Promise<string> => {
    const { meeting, participant } = await requireInvite(ref);

    if (!participant || !ROLES_THAT_MAY_SHARE_LINK.has(participant.role)) {
        throw new Error("Conflict: this link is not available to you");
    }
    if (!meeting.public_link) throw new Error("No public link for this meeting");

    return meeting.public_link;
};

export const joinSession = async (ref: string, deviceKey: string) => {
    const found = await requireInvite(ref);
    assertJoinable(found.meeting);

    const { meeting, participant } = found;
    if (!participant) {
        throw new Error("Conflict: enter your name and email to join, then open your own link");
    }

    await assertNotCompleted(meeting, participant);
    await claimDevice(meeting, participant, deviceKey);

    if (participant.admission_state === "ADMITTED" && participant.acs_user_id) {
        return { state: "ADMITTED" as const, ...(await credentialsFor(meeting, participant)) };
    }

    if (participant.admission_state === "DENIED") {
        throw new Error("Conflict: an organizer declined this request");
    }

    const pending = {
        state: "PENDING" as const,
        participantId: Number(participant.meeting_participant_id),
        sessionReference: meeting.uuid,
        displayName: callName(participant),
        role: participant.role,
    };

    if (participant.admission_state === "PENDING") return pending;

    if (entersLobby(participant.role)) {
        await meetingRepo.markWaiting(participant);

        trace("meeting", meeting.uuid, "lobby_waiting", {
            participantId: Number(participant.meeting_participant_id),
        });
        await recordEvent(scopeOfMeeting(meeting), {
            track: "PARTICIPANT_ADMISSION",
            provider: "SYSTEM",
            eventType: "PARTICIPANT_LOBBY_WAITING",
            toStatus: "PENDING",
            message: `${callName(participant)} is waiting in the lobby`,
            details: { participantId: Number(participant.meeting_participant_id), role: participant.role },
        });
        emitLobbyWaiting(meeting.uuid, lobbyEntry(participant));

        return pending;
    }

    return { state: "ADMITTED" as const, ...(await provision(meeting, participant)) };
};

export const claimCredentials = async (
    ref: string,
    deviceKey: string | null,
): Promise<IMeetingJoinCredentials> => {
    const { meeting, participant } = await requireInvite(ref);
    assertJoinable(meeting);
    if (!participant) throw new Error("Conflict: this link has not been opened yet");
    assertSameDevice(participant, deviceKey);

    if (participant.admission_state === "PENDING") {
        throw new Error("Conflict: still waiting for an organizer");
    }
    if (participant.admission_state !== "ADMITTED") {
        throw new Error(
            `Conflict: this request was ${participant.denied_reason ?? participant.admission_state}`,
        );
    }

    return credentialsFor(meeting, participant);
};

export const refreshToken = async (
    ref: string,
    deviceKey: string | null,
): Promise<IMeetingJoinCredentials> => {
    const { meeting, participant } = await requireInvite(ref);
    assertJoinable(meeting);

    if (!participant || participant.admission_state !== "ADMITTED") {
        throw new Error("Conflict: this participant is not in the call");
    }
    assertSameDevice(participant, deviceKey);

    return credentialsFor(meeting, participant);
};

export const leaveSession = async (
    ref: string,
    deviceKey: string | null,
): Promise<{ participantId: number }> => {
    const { meeting, participant } = await requireInvite(ref);
    if (!participant) throw new Error("Conflict: this link has not been opened yet");
    // Otherwise a second browser could pull the real candidate out of the call.
    assertSameDevice(participant, deviceKey);

    const participantId = Number(participant.meeting_participant_id);
    if (participant.admission_state === "LEFT") return { participantId };

    const scope = scopeOfMeeting(meeting);
    const previousState = participant.admission_state;

    if (meeting.room_id && participant.acs_user_id) {
        await acs
            .removeRoomParticipant(meeting.room_id, participant.acs_user_id)
            .catch(async (error) => {
                traceFailure("meeting", meeting.uuid, "remove-room-participant", error);
                await recordFailure(
                    scope,
                    {
                        track: "AZURE_CALLING",
                        provider: "ACS",
                        eventType: "ROOM_PARTICIPANT_REMOVE_FAILED",
                        message: `${callName(participant)} could not be removed from the call room`,
                        details: { participantId, role: participant.role },
                    },
                    error,
                );
            });
    }

    await meetingRepo.markLeft(participant);

    if (participant.role !== "ORGANIZER") {
        await vaRepo
            .markInterrupted(Number(meeting.meeting_session_id))
            .catch(async (error) => {
                traceFailure("meeting", meeting.uuid, "mark-interrupted", error);
                await recordFailure(
                    scope,
                    {
                        track: "SCHEDULING",
                        provider: "SYSTEM",
                        eventType: "BOOKING_INTERRUPT_FAILED",
                        message: "The booking could not be marked as interrupted",
                        details: { participantId, role: participant.role },
                    },
                    error,
                );
            });
    }

    if (participant.role === "AGENT") {
        await interviewCalls.recordInterruption(Number(meeting.company_id), Number(meeting.meeting_session_id));

        const submitted = await vaRepo
            .markCompletedIfSubmitted(Number(meeting.meeting_session_id))
            .catch((error) => {
                traceFailure("meeting", meeting.uuid, "mark-completed", error);
                return false;
            });

        // A minute for the humans to wrap up, then the call ends for everyone and the room is gone.
        if (submitted) {
            trace("meeting", meeting.uuid, "ending_after_agent", { inMs: MINUTE_MS });
            setTimeout(() => {
                void endAfterSubmission(meeting).catch((error) =>
                    traceFailure("meeting", meeting.uuid, "end-after-submission", error),
                );
            }, MINUTE_MS);
        }
    }

    trace("meeting", meeting.uuid, "left", { participantId, role: participant.role });
    await recordEvent(scope, {
        track: "PARTICIPANT_ADMISSION",
        provider: "SYSTEM",
        eventType: "PARTICIPANT_LEFT",
        fromStatus: previousState,
        toStatus: "LEFT",
        message: `${callName(participant)} left the call`,
        details: { participantId, role: participant.role },
    });
    emitParticipantLeft(meeting.uuid, { participantId, displayName: callName(participant) });

    return { participantId };
};

export const listLobby = async (
    reference: string,
    organiserRef: string,
): Promise<IMeetingLobbyEntry[]> => {
    const { meeting } = await requireOrganiser(organiserRef, reference);
    const waiting = await meetingRepo.listLobby(meeting.meeting_session_id);
    return waiting.map(lobbyEntry);
};

export const hostAgent = async (organiserRef: string): Promise<IMeetingAgentHandoff> => {
    const { meeting, organiser } = await requireOrganiser(organiserRef);
    assertJoinable(meeting);

    const participants = await meetingRepo.findParticipants(meeting.meeting_session_id);
    const agent = participants.find((participant) => participant.role === "AGENT");

    if (!agent) return { agentRef: null, outcome: "NO_AGENT" };
    if (agent.admission_state === "DENIED" && agent.denied_reason !== "LOBBY_TIMEOUT") {
        return { agentRef: null, outcome: "DENIED" };
    }

    if (!(await meetingRepo.claimAgentForLobby(agent))) {
        return { agentRef: null, outcome: "ALREADY_IN" };
    }
    await agent.reload();

    trace("meeting", meeting.uuid, "lobby_waiting", {
        participantId: Number(agent.meeting_participant_id),
        hostedBy: Number(organiser.meeting_participant_id),
    });
    await recordEvent(scopeOfMeeting(meeting), {
        track: "PARTICIPANT_ADMISSION",
        provider: "SYSTEM",
        eventType: "AGENT_LOBBY_WAITING",
        toStatus: "PENDING",
        actor: { type: "PARTICIPANT", id: Number(organiser.meeting_participant_id) },
        message: "The AI interviewer was asked to join and is waiting in the lobby",
        details: { participantId: Number(agent.meeting_participant_id) },
    });
    emitLobbyWaiting(meeting.uuid, lobbyEntry(agent));

    return { agentRef: agent.session_token, outcome: "HOSTING" };
};

export const decideAdmission = async (input: {
    sessionReference: string;
    participantId: number;
    organiserRef: string;
    decision: "ADMIT" | "DENY";
    reason?: string;
}): Promise<{ participantId: number; decision: "ADMITTED" | "DENIED" }> => {
    const { meeting, organiser } = await requireOrganiser(input.organiserRef, input.sessionReference);
    assertJoinable(meeting);

    const waiting = await meetingRepo.findParticipantById(
        meeting.meeting_session_id,
        input.participantId,
    );

    if (!waiting) throw new Error(`No participant ${input.participantId} in this session`);

    const decidable =
        waiting.admission_state === "PENDING" ||
        (waiting.admission_state === "DENIED" && input.decision === "ADMIT");

    if (!decidable) {
        throw new Error(`Conflict: that request is already ${waiting.admission_state}`);
    }

    if (input.decision === "DENY") {
        await meetingRepo.recordDenial(waiting, {
            reason: "DENIED_BY_ORGANISER",
            decidedBy: Number(organiser.meeting_participant_id),
        });

        trace("meeting", meeting.uuid, "denied", { participantId: input.participantId });
        await recordEvent(scopeOfMeeting(meeting), {
            track: "PARTICIPANT_ADMISSION",
            provider: "SYSTEM",
            eventType: "PARTICIPANT_DENIED",
            fromStatus: waiting.admission_state,
            toStatus: "DENIED",
            actor: { type: "PARTICIPANT", id: Number(organiser.meeting_participant_id) },
            note: input.reason,
            message: `${callName(waiting)} was declined by an organizer`,
            details: { participantId: input.participantId, role: waiting.role },
        });
        await recordDeclined(meeting, waiting, "JOIN_REJECTED", `${waiting.role} was declined by an organizer`);
        emitAdmission(input.participantId, { decision: "DENIED", reason: input.reason });
        return { participantId: input.participantId, decision: "DENIED" };
    }

    if (seatsRemaining(meeting) <= 0) throw new Error("Conflict: the room is full");

    await meetingRepo.recordAdmission(waiting, Number(organiser.meeting_participant_id));
    await provision(meeting, waiting, Number(organiser.meeting_participant_id));

    emitAdmission(input.participantId, { decision: "ADMITTED" });
    return { participantId: input.participantId, decision: "ADMITTED" };
};

export const sweepLobbyTimeouts = async (): Promise<number> => {
    const cutoff = new Date(Date.now() - Env.virtualAvatar.VA_LOBBY_TIMEOUT_MINUTES * MINUTE_MS);
    const stale = await meetingRepo.findStaleLobbyEntries(cutoff);

    for (const participant of stale) {
        await meetingRepo.recordDenial(participant, { reason: "LOBBY_TIMEOUT", decidedBy: null });
        const meeting = await meetingRepo.findById(participant.meeting_session_id);
        if (meeting) {
            await recordEvent(scopeOfMeeting(meeting), {
                track: "PARTICIPANT_ADMISSION",
                provider: "SYSTEM",
                eventType: "PARTICIPANT_LOBBY_TIMEOUT",
                toStatus: "DENIED",
                message: `${callName(participant)} waited too long in the lobby and was declined`,
                details: {
                    participantId: Number(participant.meeting_participant_id),
                    role: participant.role,
                    timeoutMinutes: Env.virtualAvatar.VA_LOBBY_TIMEOUT_MINUTES,
                },
            });
            await recordDeclined(
                meeting,
                participant,
                "LOBBY_TIMEOUT",
                `${participant.role} waited too long in the lobby and was declined`,
            );
        }
        emitAdmission(Number(participant.meeting_participant_id), {
            decision: "DENIED",
            reason: "LOBBY_TIMEOUT",
        });
    }

    return stale.length;
};

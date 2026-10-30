import crypto from "node:crypto";
import { Env } from "../../config/env.config";
import {
    MINUTE_MS,
    hasEnded,
    isClosed,
    isFinal,
    liveStatus,
    mintToken,
    occupancyOf,
    roomWindow,
    sameSchedule,
    scheduleFrom,
    scheduleOf,
} from "../../helpers/meeting.helper";
import { trace, traceFailure } from "../../helpers/trace.helper";
import {
    ICancelMeetingFromInvite,
    ICreateMeetingFromInvite,
    IMeetingParticipantView,
    IMeetingSessionView,
    MeetingStatus,
} from "../../interfaces/IMeeting.interface";
import MeetingParticipant from "../../models/meetingParticipant.model";
import MeetingSession from "../../models/meetingSession.model";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import * as vaRepo from "../../repositories/meeting/vaSchedule.repository";
import * as candidateRepo from "../../repositories/workable/candidate.repository";
import { emitParticipantLeft, emitSessionEnded } from "../../sockets/virtualAvatar.socket";
import * as acs from "../acs/acs.service";
import * as acsRecording from "../acs/acsRecording.service";
import { endCallForMeeting } from "../interview/interview.service";
import {
    sendMeetingCancellations,
    sendMeetingInvites,
    sendMeetingReschedules,
} from "./meetingInvite.service";
import { stopForMeeting } from "./meetingRecording.service";
import { locksToOneDevice, resolveRole } from "./meetingRole.service";
import { syncBlocks } from "./vaSchedule.service";

const asTopic = (summary: string | null): string | null => summary?.slice(0, 150) ?? null;

const linkFor = (token: string): string => `${Env.virtualAvatar.VA_JOIN_BASE_URL}?ref=${token}`;

const participantView = (participant: MeetingParticipant): IMeetingParticipantView => ({
    participantId: Number(participant.meeting_participant_id),
    email: participant.email,
    displayName: participant.display_name,
    role: participant.role,
    candidateId: participant.candidate_id,
    sessionLink: participant.session_link,
    emailStatus: participant.email_status,
});

const meetingView = (
    meeting: MeetingSession,
    participants: MeetingParticipant[],
    alreadyExisted: boolean,
): IMeetingSessionView => ({
    meetingSessionId: Number(meeting.meeting_session_id),
    uuid: meeting.uuid,
    topic: meeting.topic,
    startsAt: meeting.start_time.toISOString(),
    endsAt: meeting.end_time?.toISOString() ?? null,
    roomId: meeting.room_id,
    publicLink: meeting.public_link,
    meetingStatus: meeting.meeting_status,
    participants: participants.map(participantView),
    alreadyExisted,
});

const viewOf = async (meeting: MeetingSession, alreadyExisted = true): Promise<IMeetingSessionView> =>
    meetingView(meeting, await meetingRepo.findParticipants(meeting.meeting_session_id), alreadyExisted);

export const requireMeeting = async (companyId: number, reference: string): Promise<MeetingSession> => {
    const meeting = /^\d+$/.test(reference)
        ? await meetingRepo.findById(Number(reference))
        : await meetingRepo.findByUuid(reference);

    if (!meeting || Number(meeting.company_id) !== companyId) {
        throw new Error(`No meeting ${reference} for company ${companyId}`);
    }
    return meeting;
};

const shutDownSession = async (meeting: MeetingSession): Promise<void> => {
    // The recorder's connection hangs up for everyone, so it goes before the room it sits in.
    await stopForMeeting(meeting);

    if (meeting.room_id) {
        await acs.endRoom(meeting.room_id).catch((error) => {
            traceFailure("meeting", meeting.uuid, "end-room", error);
        });
    }

    await meetingRepo.closeAttendance(meeting.meeting_session_id);
    await endCallForMeeting(Number(meeting.company_id), Number(meeting.meeting_session_id));
};

export const getMeeting = async (companyId: number, uuid: string): Promise<IMeetingSessionView> =>
    viewOf(await requireMeeting(companyId, uuid));

export const listMeetings = async (input: {
    companyId: number;
    status?: MeetingStatus;
    limit: number;
    offset: number;
}): Promise<{ meetings: IMeetingSessionView[]; total: number }> => {
    const { rows, total } = await meetingRepo.listMeetings(input);
    return { meetings: rows.map((row) => meetingView(row, [], true)), total };
};

/** Only the rows that joined - every time comes off the row, never off the meeting. */
export const listAttendees = async (companyId: number, reference: string) => {
    const meeting = await requireMeeting(companyId, reference);
    const attendees = await meetingRepo.findAttendees(meeting.meeting_session_id);
    const live = !isClosed(meeting);

    return {
        sessionReference: meeting.uuid,
        meetingStatus: liveStatus(meeting),
        total: attendees.length,
        attendees: attendees.map((participant) => {
            const joinedAt = participant.joined_ts as Date;
            const leftAt = participant.left_ts;

            return {
                participantId: Number(participant.meeting_participant_id),
                name: participant.display_name ?? participant.email,
                email: participant.email,
                role: participant.role,
                candidateId: participant.candidate_id,
                admissionState: participant.admission_state,
                joinedAt: joinedAt.toISOString(),
                leftAt: leftAt?.toISOString() ?? null,
                stillInCall: leftAt === null && live,
                durationSeconds: leftAt
                    ? Math.max(Math.round((leftAt.getTime() - joinedAt.getTime()) / 1000), 0)
                    : null,
            };
        }),
    };
};

export const endMeeting = async (
    companyId: number,
    uuid: string,
    reason?: string,
): Promise<IMeetingSessionView> => {
    const meeting = await requireMeeting(companyId, uuid);

    if (!hasEnded(meeting)) {
        await shutDownSession(meeting);
        await meetingRepo.markEnded(meeting, reason ?? null);
        await vaRepo.markFinished({ meetingSessionId: meeting.meeting_session_id });
        void syncBlocks();
        trace("meeting", uuid, "ended", { reason: reason ?? null });
        emitSessionEnded(uuid, { reason: reason ?? null });
    }

    return viewOf(meeting);
};

/** Not endMeeting: the schedule sync may already have marked it ENDED with the room still open. */
export const endAfterSubmission = async (meeting: MeetingSession): Promise<void> => {
    await meeting.reload();

    if (meeting.room_id && !meeting.call_connection_id) {
        await acsRecording
            .connectToRoom(meeting.room_id)
            .then((connection) => acsRecording.hangUpConnection(connection.callConnectionId))
            .catch((error) => traceFailure("meeting", meeting.uuid, "hangup-all", error));
    }

    await shutDownSession(meeting);
    if (!hasEnded(meeting)) await meetingRepo.markEnded(meeting, "SUBMITTED");

    trace("meeting", meeting.uuid, "ended", { reason: "SUBMITTED" });
    emitSessionEnded(meeting.uuid, { reason: "SUBMITTED" });
};

export const extendMeeting = async (
    companyId: number,
    uuid: string,
    minutes: number,
): Promise<IMeetingSessionView> => {
    const meeting = await requireMeeting(companyId, uuid);
    if (hasEnded(meeting)) {
        throw new Error(`Conflict: meeting ${uuid} has been ${meeting.meeting_status.toLowerCase()}`);
    }
    if (!meeting.room_id) throw new Error("Conflict: this meeting has no room to extend");

    const base = meeting.end_time ?? new Date();
    const endTime = new Date(Math.max(base.getTime(), Date.now()) + minutes * MINUTE_MS);

    await acs.updateRoomValidUntil(meeting.room_id, endTime);
    await meetingRepo.setEndTime(meeting, endTime);
    await vaRepo.setEnd(meeting.meeting_session_id, {
        endTime,
        occupancyEnd: occupancyOf(scheduleOf(meeting)).endsAt,
    });
    void syncBlocks();

    trace("meeting", uuid, "extended", { endTime: endTime.toISOString() });
    return viewOf(meeting);
};

export const revokeLinks = async (companyId: number, uuid: string): Promise<IMeetingSessionView> => {
    const meeting = await requireMeeting(companyId, uuid);
    await meetingRepo.markRevoked(meeting);
    await vaRepo.markCancelled(meeting.meeting_session_id, "REVOKED");
    void syncBlocks();
    trace("meeting", uuid, "links_revoked");
    return viewOf(meeting);
};

/* The interviewer's way past the one-browser lock */
export const resetCandidateSession = async (
    companyId: number,
    uuid: string,
): Promise<IMeetingSessionView> => {
    const meeting = await requireMeeting(companyId, uuid);
    if (hasEnded(meeting)) {
        throw new Error(`Conflict: meeting ${uuid} has been ${meeting.meeting_status.toLowerCase()}`);
    }

    const participants = await meetingRepo.findParticipants(meeting.meeting_session_id);
    const candidates = participants.filter((participant) => locksToOneDevice(participant.role));
    if (!candidates.length) throw new Error(`No candidate in meeting ${uuid}`);

    for (const candidate of candidates) {
        const inCall = candidate.admission_state === "ADMITTED";

        if (inCall && meeting.room_id && candidate.acs_user_id) {
            await acs
                .removeRoomParticipant(meeting.room_id, candidate.acs_user_id)
                .catch((error) => traceFailure("meeting", uuid, "remove-room-participant", error));
        }
        if (inCall) {
            await meetingRepo.markLeft(candidate);
            emitParticipantLeft(uuid, {
                participantId: Number(candidate.meeting_participant_id),
                displayName: candidate.display_name ?? "Guest",
            });
        }

        await meetingRepo.unbindDevice(candidate);
    }

    trace("meeting", uuid, "candidate_session_reset", {
        participantIds: candidates.map((candidate) => Number(candidate.meeting_participant_id)),
    });
    return viewOf(meeting);
};

/* ==== TEMP: hardcoded extra organizer ===================================== *
 * Mints one more ORGANIZER link for a fixed address on every meeting and
 * prints it. To restore the default flow, delete this block and the two
 * `tempOrganizerLink(...)` calls below. Nothing else
 * references either.
 * ========================================================================== */

const TEMP_ORGANIZER_EMAIL = "uddhavj2001@gmail.com";

const tempOrganizerLink = async (meeting: MeetingSession): Promise<void> => {
    const participants = await meetingRepo.findParticipants(meeting.meeting_session_id);
    const existing = participants.find((row) => row.email === TEMP_ORGANIZER_EMAIL);

    if (existing) return;

    const token = mintToken();
    await meetingRepo.createParticipant({
        meetingSessionId: meeting.meeting_session_id,
        roomId: meeting.room_id,
        email: TEMP_ORGANIZER_EMAIL,
        displayName: null,
        role: "ORGANIZER",
        candidateId: (await candidateRepo.findByEmail(TEMP_ORGANIZER_EMAIL))?.candidate_id ?? null,
        sessionToken: token,
        sessionLink: linkFor(token),
    });
};

/* ==== end TEMP ============================================================ */

const updateFromInvite = async (
    meeting: MeetingSession,
    input: ICreateMeetingFromInvite,
): Promise<IMeetingSessionView> => {
    if (isFinal(meeting)) {
        trace("meeting", meeting.uuid, "update_ignored", { status: meeting.meeting_status });
        return viewOf(meeting);
    }

    const previous = scheduleOf(meeting);
    const current = scheduleFrom(input.startsAt, input.endsAt);

    if (sameSchedule(previous, current)) {
        await meetingRepo.setSourceMessageId(meeting, input.sourceMessageId);
        trace("meeting", meeting.uuid, "redelivered");
    } else {
        await meetingRepo.markRescheduled(meeting, {
            startTime: current.startsAt,
            endTime: current.endsAt,
            sourceMessageId: input.sourceMessageId,
        });

        if (meeting.room_id) {
            const window = roomWindow(current);
            await acs
                .updateRoomWindow(meeting.room_id, window.validFrom, window.validUntil)
                .catch((error) => traceFailure("meeting", meeting.uuid, "room-window", error));
        }

        trace("meeting", meeting.uuid, "rescheduled", {
            previousStartsAt: previous.startsAt.toISOString(),
            previousEndsAt: previous.endsAt.toISOString(),
            startsAt: current.startsAt.toISOString(),
            endsAt: current.endsAt.toISOString(),
        });

        await sendMeetingReschedules(meeting, previous);
    }

    await tempOrganizerLink(meeting);
    await sendMeetingInvites(meeting);
    return viewOf(meeting);
};

export const createFromInvite = async (
    input: ICreateMeetingFromInvite,
): Promise<IMeetingSessionView> => {
    if (!Env.virtualAvatar.VA_JOIN_BASE_URL) {
        throw new Error("AGENTIC_AVATAR_BASE_URL is not set - a session link would point nowhere");
    }

    const existing = input.icsUid ? await meetingRepo.findByIcsUid(input.icsUid) : null;
    if (existing) return updateFromInvite(existing, input);

    const uuid = crypto.randomUUID();
    const schedule = scheduleFrom(input.startsAt, input.endsAt);
    const window = roomWindow(schedule);
    const owner = await acs.createUserAndToken();

    const [room, chatThreadId] = await Promise.all([
        acs.createRoom({
            validFrom: window.validFrom,
            validUntil: window.validUntil,
            ownerCommunicationUserId: owner.communicationUserId,
        }),
        acs
            .createChatThread(owner.token, owner.communicationUserId, asTopic(input.topic) ?? uuid)
            .catch((error) => {
                traceFailure("meeting", uuid, "chat-thread", error);
                return null;
            }),
    ]);

    const publicToken = mintToken();

    const meeting = await meetingRepo.createMeeting({
        companyId: Env.meeting.MEETING_DEFAULT_COMPANY_ID,
        uuid,
        icsUid: input.icsUid,
        sourceMessageId: input.sourceMessageId,
        topic: asTopic(input.topic),
        startTime: schedule.startsAt,
        endTime: schedule.endsAt,
        roomId: room.id,
        ownerAcsUserId: owner.communicationUserId,
        acsChatThreadId: chatThreadId,
        publicToken,
        publicLink: linkFor(publicToken),
        recordingRequested: Env.virtualAvatar.VA_RECORD_MEETINGS,
    });

    for (const recipient of input.recipients) {
        const token = mintToken();
        // The registered profile wins over whatever name the invite happened to carry.
        const candidate = await candidateRepo.findByEmail(recipient.email);

        await meetingRepo.createParticipant({
            meetingSessionId: meeting.meeting_session_id,
            roomId: room.id,
            email: recipient.email,
            displayName: candidate?.name ?? recipient.displayName,
            role: resolveRole(recipient.email),
            candidateId: candidate?.candidate_id ?? null,
            sessionToken: token,
            sessionLink: linkFor(token),
        });
    }

    await tempOrganizerLink(meeting);
    await sendMeetingInvites(meeting);

    const view = await viewOf(meeting, false);

    trace("meeting", uuid, "created", {
        roomId: room.id,
        chatThreadId,
        invited: view.participants.length,
        startsAt: schedule.startsAt.toISOString(),
        endsAt: schedule.endsAt.toISOString(),
        roomOpensAt: window.validFrom.toISOString(),
    });

    return view;
};

export const cancelFromInvite = async (
    input: ICancelMeetingFromInvite,
): Promise<IMeetingSessionView | null> => {
    const meeting = input.icsUid ? await meetingRepo.findByIcsUid(input.icsUid) : null;
    if (!meeting) return null;

    if (hasEnded(meeting)) {
        trace("meeting", meeting.uuid, "cancel_ignored", { status: meeting.meeting_status });
        return viewOf(meeting);
    }

    await meetingRepo.markCancelled(meeting, input.sourceMessageId);
    await vaRepo.markCancelled(meeting.meeting_session_id, "INVITE_CANCELLED");
    void syncBlocks();
    await shutDownSession(meeting);

    trace("meeting", meeting.uuid, "cancelled");
    emitSessionEnded(meeting.uuid, { reason: "CANCELLED" });

    await sendMeetingCancellations(meeting);
    return viewOf(meeting);
};

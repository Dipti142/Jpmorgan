import { fn, col, Op, where as sqlWhere } from "sequelize";
import {
    MeetingAcsRole,
    MeetingDenialReason,
    MeetingRole,
    MeetingStatus,
    MeetingTranscriptionStatus,
} from "../../interfaces/IMeeting.interface";
import Company from "../../models/company.model";
import connection from "../../models/index";
import MeetingParticipant from "../../models/meetingParticipant.model";
import MeetingSession from "../../models/meetingSession.model";

/**
 * Every read and write the meeting flow needs. Nothing above this file builds a
 * where clause.
 */

export interface ICreateMeetingRow {
    companyId: number;
    uuid: string;
    icsUid: string | null;
    sourceMessageId: string | null;
    topic: string | null;
    startTime: Date;
    endTime: Date | null;
    roomId: string | null;
    ownerAcsUserId: string | null;
    acsChatThreadId: string | null;
    publicToken: string;
    publicLink: string;
    recordingRequested: boolean;
}

export const createMeeting = async (input: ICreateMeetingRow): Promise<MeetingSession> =>
    MeetingSession.create({
        company_id: input.companyId,
        uuid: input.uuid,
        ics_uid: input.icsUid,
        source_message_id: input.sourceMessageId,
        topic: input.topic,
        start_time: input.startTime,
        end_time: input.endTime,
        room_id: input.roomId,
        owner_acs_user_id: input.ownerAcsUserId,
        acs_chat_thread_id: input.acsChatThreadId,
        public_token: input.publicToken,
        public_link: input.publicLink,
        meeting_status: "SCHEDULED",
        joined_count: 0,
        recording_requested: input.recordingRequested,
    });

/** The dedupe read. A redelivered or rescheduled invite carries the same UID. */
export const findByIcsUid = async (icsUid: string): Promise<MeetingSession | null> =>
    MeetingSession.findOne({ where: { ics_uid: icsUid } });

export const findById = async (meetingSessionId: number): Promise<MeetingSession | null> =>
    MeetingSession.findByPk(meetingSessionId);

export const findByUuid = async (uuid: string): Promise<MeetingSession | null> =>
    MeetingSession.findOne({ where: { uuid } });

export const findCompany = async (companyId: number): Promise<Company | null> =>
    Company.findByPk(companyId);

export const markRescheduled = async (
    meeting: MeetingSession,
    input: { startTime: Date; endTime: Date; sourceMessageId: string | null },
): Promise<MeetingSession> => {
    meeting.set({
        start_time: input.startTime,
        end_time: input.endTime,
        source_message_id: input.sourceMessageId ?? meeting.source_message_id,
        meeting_status: "RESCHEDULED",
    });
    await meeting.save();
    return meeting;
};

export const setSourceMessageId = async (
    meeting: MeetingSession,
    sourceMessageId: string | null,
): Promise<MeetingSession> => {
    meeting.set({ source_message_id: sourceMessageId ?? meeting.source_message_id });
    await meeting.save();
    return meeting;
};

export const setCallConnection = async (
    meetingSessionId: number,
    input: { callConnectionId: string; serverCallId: string },
): Promise<void> => {
    await MeetingSession.update(
        { call_connection_id: input.callConnectionId, server_call_id: input.serverCallId },
        { where: { meeting_session_id: meetingSessionId } },
    );
};

export const findByCallConnectionId = async (callConnectionId: string): Promise<MeetingSession | null> =>
    MeetingSession.findOne({ where: { call_connection_id: callConnectionId } });

export const setTranscription = async (
    meeting: MeetingSession,
    input: { status?: MeetingTranscriptionStatus; language?: string },
): Promise<void> => {
    meeting.set({
        ...(input.status && { transcription_status: input.status }),
        ...(input.language && { transcription_language: input.language }),
    });
    await meeting.save();
};

export const setTranscriptLanguage = async (
    participant: MeetingParticipant,
    language: string | null,
): Promise<void> => {
    participant.set({ transcript_language: language });
    await participant.save();
};

export const setJobShortCode = async (
    meetingSessionId: number,
    jobShortCode: string,
): Promise<void> => {
    await MeetingSession.update(
        { job_short_code: jobShortCode },
        { where: { meeting_session_id: meetingSessionId } },
    );
};

export const setCandidateId = async (
    meetingSessionId: number,
    input: { email: string; candidateId: string },
): Promise<void> => {
    await MeetingParticipant.update(
        { candidate_id: input.candidateId },
        {
            where: {
                meeting_session_id: meetingSessionId,
                role: "CANDIDATE",
                email: input.email.trim().toLowerCase(),
            },
        },
    );
};

export interface ICreateParticipantRow {
    meetingSessionId: number;
    roomId: string | null;
    email: string;
    displayName: string | null;
    role: MeetingRole;
    candidateId: string | null;
    sessionToken: string;
    sessionLink: string;
}

export const createParticipant = async (
    input: ICreateParticipantRow,
): Promise<MeetingParticipant> =>
    MeetingParticipant.create({
        meeting_session_id: input.meetingSessionId,
        meeting_session_room_id: input.roomId,
        email: input.email.trim().toLowerCase(),
        display_name: input.displayName,
        role: input.role,
        candidate_id: input.candidateId,
        session_token: input.sessionToken,
        session_link: input.sessionLink,
        email_status: "PENDING",
        admission_state: "INVITED",
        email_template_data: {},
    });

export const findParticipantByEmail = async (
    meetingSessionId: number,
    email: string,
): Promise<MeetingParticipant | null> =>
    MeetingParticipant.findOne({
        where: {
            meeting_session_id: meetingSessionId,
            [Op.and]: [sqlWhere(fn("lower", col("email")), email.trim().toLowerCase())],
        },
    });

export const findParticipants = async (
    meetingSessionId: number,
): Promise<MeetingParticipant[]> =>
    MeetingParticipant.findAll({
        where: { meeting_session_id: meetingSessionId },
        order: [["created_at", "ASC"]],
    });

/** Nobody is still in a meeting that is over, so whoever never called leave is closed here. */
export const closeAttendance = async (meetingSessionId: number): Promise<void> => {
    await MeetingParticipant.update(
        { admission_state: "LEFT", left_ts: new Date(), seat_no: null },
        {
            where: {
                meeting_session_id: meetingSessionId,
                admission_state: "ADMITTED",
                joined_ts: { [Op.ne]: null },
            },
        },
    );
};

/** Who was actually in the call: joined_ts is set only once credentials went out. */
export const findAttendees = async (meetingSessionId: number): Promise<MeetingParticipant[]> =>
    MeetingParticipant.findAll({
        where: { meeting_session_id: meetingSessionId, joined_ts: { [Op.ne]: null } },
        order: [["joined_ts", "ASC"]],
    });

export const markEmailSent = async (
    participant: MeetingParticipant,
    templateData: Record<string, unknown>,
): Promise<void> => {
    participant.set({
        email_status: "SENT",
        email_sent_ts: new Date(),
        email_error: null,
        email_template_data: templateData,
    });
    await participant.save();
};

/** Left retryable: anything not SENT is picked up again by the next send. */
export const markEmailFailed = async (
    participant: MeetingParticipant,
    error: string,
): Promise<void> => {
    participant.set({ email_status: "FAILED", email_error: error });
    await participant.save();
};

/** No company scope: the token IS the credential, and it names one person. */
export const findBySessionToken = async (token: string): Promise<MeetingParticipant | null> =>
    MeetingParticipant.findOne({ where: { session_token: token } });

export const listMeetings = async (input: {
    companyId: number;
    status?: MeetingStatus;
    limit: number;
    offset: number;
}): Promise<{ rows: MeetingSession[]; total: number }> => {
    const { rows, count } = await MeetingSession.findAndCountAll({
        where: {
            company_id: input.companyId,
            ...(input.status ? { meeting_status: input.status } : {}),
        },
        order: [["start_time", "DESC"]],
        limit: input.limit,
        offset: input.offset,
    });

    return { rows, total: count };
};

export const markEnded = async (
    meeting: MeetingSession,
    reason: string | null,
): Promise<MeetingSession> => {
    meeting.set({ meeting_status: "ENDED", ended_ts: new Date(), end_reason: reason });
    await meeting.save();
    return meeting;
};

export const markCancelled = async (
    meeting: MeetingSession,
    sourceMessageId: string | null,
): Promise<MeetingSession> => {
    meeting.set({
        meeting_status: "CANCELLED",
        ended_ts: new Date(),
        end_reason: "INVITE_CANCELLED",
        source_message_id: sourceMessageId ?? meeting.source_message_id,
    });
    await meeting.save();
    return meeting;
};

export const markRevoked = async (meeting: MeetingSession): Promise<MeetingSession> => {
    meeting.set({ meeting_status: "REVOKED" });
    await meeting.save();
    return meeting;
};

export const setEndTime = async (
    meeting: MeetingSession,
    endTime: Date,
): Promise<MeetingSession> => {
    meeting.set({ end_time: endTime });
    await meeting.save();
    return meeting;
};

export const findByPublicToken = async (token: string): Promise<MeetingSession | null> =>
    MeetingSession.findOne({ where: { public_token: token } });

export const findParticipantById = async (
    meetingSessionId: number,
    participantId: number,
): Promise<MeetingParticipant | null> =>
    MeetingParticipant.findOne({
        where: { meeting_session_id: meetingSessionId, meeting_participant_id: participantId },
    });
export const listLobby = async (meetingSessionId: number): Promise<MeetingParticipant[]> =>
    MeetingParticipant.findAll({
        where: { meeting_session_id: meetingSessionId, admission_state: "PENDING" },
        order: [["created_at", "ASC"]],
    });

export const findStaleLobbyEntries = async (before: Date): Promise<MeetingParticipant[]> =>
    MeetingParticipant.findAll({
        where: { admission_state: "PENDING", updated_at: { [Op.lt]: before } },
    });

export const markWaiting = async (participant: MeetingParticipant): Promise<void> => {
    participant.set({ admission_state: "PENDING" });
    await participant.save();
};

export const claimAgentForLobby = async (participant: MeetingParticipant): Promise<boolean> => {
    const [claimed] = await MeetingParticipant.update(
        { admission_state: "PENDING", denied_reason: null },
        {
            where: {
                meeting_participant_id: participant.meeting_participant_id,
                [Op.or]: [
                    { admission_state: { [Op.in]: ["INVITED", "LEFT"] } },
                    { admission_state: "DENIED", denied_reason: "LOBBY_TIMEOUT" },
                ],
            },
        },
    );
    return claimed === 1;
};

/* The candidate lock.*/
export const bindDevice = async (
    participant: MeetingParticipant,
    deviceKeyHash: string,
): Promise<boolean> => {
    const [bound] = await MeetingParticipant.update(
        { device_key_hash: deviceKeyHash, device_bound_ts: new Date() },
        {
            where: {
                meeting_participant_id: participant.meeting_participant_id,
                device_key_hash: { [Op.is]: null },
            },
        },
    );
    await participant.reload();
    return bound === 1;
};

/* Interviewer reset only. */
export const unbindDevice = async (participant: MeetingParticipant): Promise<void> => {
    participant.set({ device_key_hash: null, device_bound_ts: null });
    await participant.save();
};

export const markLeft = async (participant: MeetingParticipant): Promise<void> => {
    const heldSeat = participant.admission_state === "ADMITTED" && participant.seat_no !== null;

    const [changed] = await MeetingParticipant.update(
        { admission_state: "LEFT", left_ts: new Date(), seat_no: null },
        {
            where: {
                meeting_participant_id: participant.meeting_participant_id,
                admission_state: { [Op.ne]: "LEFT" },
            },
        },
    );

    if (changed === 1 && heldSeat) {
        await MeetingSession.decrement("joined_count", {
            where: {
                meeting_session_id: participant.meeting_session_id,
                joined_count: { [Op.gt]: 0 },
            },
        });
    }

    await participant.reload();
};

export const markFirstJoin = async (meeting: MeetingSession): Promise<void> => {
    if (meeting.first_joined_ts && meeting.meeting_status !== "RESCHEDULED") return;
    meeting.set({ first_joined_ts: meeting.first_joined_ts ?? new Date(), meeting_status: "ACTIVE" });
    await meeting.save();
};

export const recordAdmission = async (
    participant: MeetingParticipant,
    decidedBy: number | null,
): Promise<void> => {
    participant.set({
        admission_state: "ADMITTED",
        denied_reason: null,
        decided_by: decidedBy,
        decided_ts: new Date(),
    });
    await participant.save();
};

export const recordDenial = async (
    participant: MeetingParticipant,
    input: { reason: MeetingDenialReason; decidedBy: number | null },
): Promise<void> => {
    participant.set({
        admission_state: "DENIED",
        denied_reason: input.reason,
        decided_by: input.decidedBy,
        decided_ts: new Date(),
    });
    await participant.save();
};


export const reserveSeat = async (
    meetingSessionId: number,
    participantId: number,
): Promise<{ seatNo: number }> => {
    const transaction = await connection.transaction();

    try {
        const meeting = await MeetingSession.findOne({
            where: { meeting_session_id: meetingSessionId },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!meeting) throw new Error("No meeting for this seat");

        if (meeting.joined_count >= meeting.max_participants) {
            throw new Error("Conflict: the room is full");
        }

        const seatNo = meeting.joined_count + 1;
        meeting.set({ joined_count: seatNo });
        await meeting.save({ transaction });

        await MeetingParticipant.update(
            { seat_no: seatNo, admission_state: "ADMITTED" },
            { where: { meeting_participant_id: participantId }, transaction },
        );

        await transaction.commit();
        return { seatNo };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

export const completeSeat = async (
    participant: MeetingParticipant,
    input: { acsUserId: string; acsRole: MeetingAcsRole },
): Promise<void> => {
    participant.set({
        acs_user_id: input.acsUserId,
        acs_role: input.acsRole,
        admission_state: "ADMITTED",
        joined_ts: new Date(),
    });
    await participant.save();
};

export const releaseSeat = async (participant: MeetingParticipant): Promise<void> => {
    const meeting = await MeetingSession.findByPk(participant.meeting_session_id);

    if (meeting && meeting.joined_count > 0) {
        meeting.set({ joined_count: meeting.joined_count - 1 });
        await meeting.save();
    }

    participant.set({ seat_no: null, admission_state: "INVITED" });
    await participant.save();
};

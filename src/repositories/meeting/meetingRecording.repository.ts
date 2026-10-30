import { Op } from "sequelize";
import { IStoredRecording, MeetingRecordingStatus } from "../../interfaces/IMeeting.interface";
import MeetingRecording from "../../models/meetingRecording.model";

export const createRecording = async (input: {
    meetingSessionId: number;
    companyId: number;
    acsRecordingId: string;
}): Promise<MeetingRecording> =>
    MeetingRecording.sequelize!.transaction(async (transaction) => {
        const previous = await MeetingRecording.max<number, MeetingRecording>("meeting_join_attempts", {
            where: { meeting_session_id: input.meetingSessionId },
            paranoid: false,
            transaction,
        });

        await MeetingRecording.update(
            { meeting_recording_status: 0 },
            {
                where: { meeting_session_id: input.meetingSessionId, meeting_recording_status: 1 },
                transaction,
            },
        );

        return MeetingRecording.create(
            {
                meeting_session_id: input.meetingSessionId,
                company_id: input.companyId,
                acs_recording_id: input.acsRecordingId,
                status: "STARTED",
                meeting_recording_status: 1,
                meeting_join_attempts: previous == null ? 0 : Number(previous) + 1,
                started_ts: new Date(),
            },
            { transaction },
        );
    });


export const findForChunk = async (
    acsRecordingId: string,
    chunkIndex: number,
): Promise<MeetingRecording | null> => {
    const existing = await MeetingRecording.findOne({
        where: { acs_recording_id: acsRecordingId, chunk_index: chunkIndex },
    });
    if (existing || chunkIndex === 0) return existing;

    const first = await MeetingRecording.findOne({
        where: { acs_recording_id: acsRecordingId, chunk_index: 0 },
    });
    if (!first) return null;

    return MeetingRecording.create({
        meeting_session_id: first.meeting_session_id,
        company_id: first.company_id,
        acs_recording_id: acsRecordingId,
        chunk_index: chunkIndex,
        meeting_recording_status: first.meeting_recording_status,
        meeting_join_attempts: first.meeting_join_attempts,
        status: "STOPPED",
        started_ts: first.started_ts,
    });
};

export const findById = async (recordingId: number): Promise<MeetingRecording | null> =>
    MeetingRecording.findByPk(recordingId);

export const listForMeeting = async (meetingSessionId: number): Promise<MeetingRecording[]> =>
    MeetingRecording.findAll({
        where: { meeting_session_id: meetingSessionId },
        order: [["created_at", "ASC"]],
    });

/** The recording still running on a meeting, if any. */
export const findActive = async (meetingSessionId: number): Promise<MeetingRecording | null> =>
    MeetingRecording.findOne({
        where: { meeting_session_id: meetingSessionId, status: { [Op.in]: ["STARTED"] } },
        order: [["created_at", "DESC"]],
    });

export const markStopped = async (recording: MeetingRecording): Promise<MeetingRecording> => {
    recording.set({ status: "STOPPED", stopped_ts: new Date() });
    await recording.save();
    return recording;
};

export const markFileReady = async (
    recording: MeetingRecording,
    input: {
        contentLocation: string | null;
        metadataLocation: string | null;
        deleteLocation: string | null;
        eventPayload: Record<string, unknown>;
    },
): Promise<MeetingRecording> => {
    recording.set({
        status: "FILE_READY",
        content_location: input.contentLocation,
        metadata_location: input.metadataLocation,
        delete_location: input.deleteLocation,
        event_payload: input.eventPayload,
    });
    await recording.save();
    return recording;
};

export const markStored = async (
    recording: MeetingRecording,
    stored: IStoredRecording,
): Promise<MeetingRecording> => {
    recording.set({
        status: "STORED",
        storage_kind: stored.storageKind,
        storage_path: stored.storagePath,
        storage_parts: stored.parts.length > 1 ? stored.parts : null,
        storage_url: stored.storageUrl,
        file_name: stored.fileName,
        size_bytes: stored.sizeBytes,
        stored_ts: new Date(),
        failure_reason: null,
    });
    await recording.save();
    return recording;
};

export const markFailed = async (
    recording: MeetingRecording,
    reason: string,
): Promise<MeetingRecording> => {
    recording.set({ status: "FAILED", failure_reason: reason });
    await recording.save();
    return recording;
};

export const setStatus = async (
    recording: MeetingRecording,
    status: MeetingRecordingStatus,
): Promise<MeetingRecording> => {
    recording.set({ status });
    await recording.save();
    return recording;
};

import { Readable } from "node:stream";
import { Env } from "../../config/env.config";
import { trace, traceFailure } from "../../helpers/trace.helper";
import {
    IMeetingRecordingLink,
    IMeetingRecordingView,
    IRecordingPart,
    IStoredRecording,
} from "../../interfaces/IMeeting.interface";
import MeetingRecording from "../../models/meetingRecording.model";
import MeetingSession from "../../models/meetingSession.model";
import * as recordingRepo from "../../repositories/meeting/meetingRecording.repository";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import { emitRecordingState } from "../../sockets/virtualAvatar.socket";
import * as acs from "../acs/acsRecording.service";
import * as applications from "./applicationDetails.service";
import * as interviewCall from "../interview/interviewCall.service";
import * as transcript from "./meetingTranscript.service";
import { presignStoredRecording, storeRecording } from "../virtualAvatar/recordingStorage.service";
import { recordEvent, recordFailure, scopeOfMeeting } from "./meetingHistory.service";

const toView = (recording: MeetingRecording, reference: string): IMeetingRecordingView => ({
    recordingId: Number(recording.meeting_recording_id),
    sessionReference: reference,
    status: recording.status,
    meetingRecordingStatus: Number(recording.meeting_recording_status),
    meetingJoinAttempts: Number(recording.meeting_join_attempts),
    fileName: recording.file_name,
    storageKind: recording.storage_kind as "local" | "gateway" | null,
    storageUrl: recording.storage_url,
    sizeBytes: recording.size_bytes === null ? null : Number(recording.size_bytes),
    partCount: recording.storage_parts?.length || 1,
    startedAt: recording.started_ts?.toISOString() ?? null,
    stoppedAt: recording.stopped_ts?.toISOString() ?? null,
    storedAt: recording.stored_ts?.toISOString() ?? null,
    failureReason: recording.failure_reason,
});

const MAX_PART_BYTES = Env.virtualAvatar.VA_RECORDING_MAX_PART_BYTES;

/** At most max bytes off the front, then the rest of the download is dropped. */
const firstBytesOf = async (source: NodeJS.ReadableStream, max: number): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    let taken = 0;

    for await (const chunk of source as Readable) {
        const slice = chunk.length > max - taken ? chunk.subarray(0, max - taken) : chunk;
        chunks.push(slice);
        taken += slice.length;
        if (taken >= max) break;
    }
    (source as Readable).destroy?.();

    return Buffer.concat(chunks);
};

const storeInParts = async (contentLocation: string, baseName: string): Promise<IStoredRecording> => {
    const parts: IRecordingPart[] = [];

    for (let index = 0; ; index += 1) {
        const source = await acs.downloadRecordingStream(contentLocation, index * MAX_PART_BYTES);
        const part = await firstBytesOf(source, MAX_PART_BYTES);
        if (!part.length) break;

        const stored = await storeRecording(part, `${baseName}-part${index + 1}.mp4`);
        parts.push({ index: index + 1, path: stored.storagePath, sizeBytes: stored.sizeBytes });

        // Short of what was asked for means the stream ran out, so that was the tail.
        if (part.length < MAX_PART_BYTES) break;
    }

    if (!parts.length) throw new Error("the recording download produced no bytes");

    return {
        storageKind: "gateway",
        storagePath: parts[0].path,
        storageUrl: null,
        fileName: `${baseName}.mp4`,
        sizeBytes: parts.reduce((total, part) => total + part.sizeBytes, 0),
        parts,
    };
};

/** The ordered slices with their running offsets, for serving a byte range across them. */
export const partsOf = (
    recording: MeetingRecording,
): { parts: (IRecordingPart & { offset: number })[]; total: number } => {
    if (recording.storage_kind !== "gateway" || !recording.storage_path) {
        throw new Error("No stored object for this recording");
    }

    const stored = recording.storage_parts?.length
        ? [...recording.storage_parts].sort((left, right) => left.index - right.index)
        : [{ index: 1, path: recording.storage_path, sizeBytes: Number(recording.size_bytes ?? 0) }];

    let total = 0;
    const parts = stored.map((part) => {
        const offset = total;
        total += Number(part.sizeBytes);
        return { ...part, sizeBytes: Number(part.sizeBytes), offset };
    });

    if (!total) throw new Error(`No stored bytes for recording ${recording.meeting_recording_id}`);
    return { parts, total };
};

const connecting = new Map<number, Promise<void>>();

const ROOM_CALL_WAIT_ATTEMPTS = 15;

export const startForMeeting = async (
    meeting: MeetingSession,
    transcribe = Env.virtualAvatar.VA_TRANSCRIBE_MEETINGS,
): Promise<void> => {
    if ((!meeting.recording_requested && !transcribe) || !meeting.room_id) {
        trace("meeting-rec", meeting.uuid, "skipped", {
            reason: meeting.room_id ? "not requested" : "no room",
        });
        return;
    }

    const id = meeting.meeting_session_id;
    const pending =
        connecting.get(id) ??
        (async () => {
            try {
                await meeting.reload();
                const live = meeting.call_connection_id ? await acs.isConnected(meeting.call_connection_id) : false;
                const running = live ? await recordingRepo.findActive(id) : null;
                if (live && (running || !meeting.recording_requested)) {
                    trace("meeting-rec", meeting.uuid, "skipped", {
                        reason: "already connected",
                        acsRecordingId: running?.acs_recording_id,
                    });
                    return;
                }

                trace("meeting-rec", meeting.uuid, "starting", { roomId: meeting.room_id, live });

                const connection = live
                    ? { callConnectionId: meeting.call_connection_id!, serverCallId: meeting.server_call_id! }
                    : await acs.connectToRoom(meeting.room_id!, transcript.spokenLocale(meeting), ROOM_CALL_WAIT_ATTEMPTS);
                if (!live) {
                    await meetingRepo.setCallConnection(id, connection);
                    if (transcribe) await transcript.startForMeeting(meeting, connection.callConnectionId);
                }

                if (meeting.recording_requested) {
                    const acsRecordingId = await acs.startRecording(connection.serverCallId);
                    await recordingRepo.createRecording({
                        meetingSessionId: id,
                        companyId: Number(meeting.company_id),
                        acsRecordingId,
                    });

                    trace("meeting-rec", meeting.uuid, "started", { acsRecordingId });
                    emitRecordingState(meeting.uuid, { status: "STARTED" });
                }
            } catch (error) {
                traceFailure("meeting-rec", meeting.uuid, "start", error);
            }
        })().finally(() => connecting.delete(id));

    connecting.set(id, pending);
    return pending;
};

export const stopForMeeting = async (meeting: MeetingSession): Promise<void> => {
    const running = await recordingRepo.findActive(meeting.meeting_session_id);
    const scope = scopeOfMeeting(meeting);

    if (running) {
        try {
            await acs.stopRecording(running.acs_recording_id);
            await recordingRepo.markStopped(running);
            trace("meeting-rec", meeting.uuid, "stopped", { acsRecordingId: running.acs_recording_id });
            emitRecordingState(meeting.uuid, { status: "STOPPED" });
            await recordEvent(scope, {
                track: "MEETING_RECORDING",
                provider: "ACS",
                eventType: "RECORDING_STOPPED",
                fromStatus: "STARTED",
                toStatus: "STOPPED",
                message: "Recording stopped",
                details: { acsRecordingId: running.acs_recording_id },
            });
        } catch (error) {
            traceFailure("meeting-rec", meeting.uuid, "stop", error);
            await recordingRepo.markFailed(
                running,
                error instanceof Error ? error.message : "stop failed",
            );
            await recordFailure(
                scope,
                {
                    track: "MEETING_RECORDING",
                    provider: "ACS",
                    eventType: "RECORDING_STOP_FAILED",
                    fromStatus: "STARTED",
                    toStatus: "FAILED",
                    message: "Recording could not be stopped cleanly",
                    details: { acsRecordingId: running.acs_recording_id },
                },
                error,
            );
        }
    }

    if (meeting.call_connection_id) {
        try {
            if (meeting.transcription_status === "ACTIVE" || meeting.transcription_status === "PAUSED") {
                await meetingRepo.setTranscription(meeting, { status: "STOPPED" });
            }
            await acs.hangUpConnection(meeting.call_connection_id);
        } catch (error) {
            traceFailure("meeting-rec", meeting.uuid, "hangup", error);
            await recordFailure(
                scope,
                {
                    track: "AZURE_CALLING",
                    provider: "ACS",
                    eventType: "CALL_HANGUP_FAILED",
                    message: "The recording connection could not be closed",
                    details: { callConnectionId: meeting.call_connection_id },
                },
                error,
            );
        }
    }
};

export const handleFileReady = async (input: {
    acsRecordingId: string;
    chunkIndex: number;
    contentLocation: string | null;
    metadataLocation: string | null;
    deleteLocation: string | null;
    eventPayload: Record<string, unknown>;
}): Promise<void> => {
    const recording = await recordingRepo.findForChunk(input.acsRecordingId, input.chunkIndex);
    if (!recording) {
        trace("meeting-rec", "eventgrid", "unknown-recording", {
            acsRecordingId: input.acsRecordingId,
            chunkIndex: input.chunkIndex,
        });
        return;
    }
    if (recording.status === "STORED") return;

    const meeting = await meetingRepo.findById(recording.meeting_session_id);
    const reference = meeting?.uuid ?? String(recording.meeting_session_id);
    const scope = {
        companyId: Number(recording.company_id),
        meetingSessionId: Number(recording.meeting_session_id),
        reference,
    };

    await recordingRepo.markFileReady(recording, input);
    await recordEvent(scope, {
        track: "MEETING_RECORDING",
        provider: "ACS",
        eventType: "RECORDING_FILE_READY",
        toStatus: "FILE_READY",
        message: "The recording file is ready on the Azure side",
        details: { acsRecordingId: input.acsRecordingId, chunkIndex: input.chunkIndex },
    });

    if (!input.contentLocation) {
        await recordingRepo.markFailed(recording, "event carried no contentLocation");
        await recordFailure(
            scope,
            {
                track: "MEETING_RECORDING",
                provider: "ACS",
                eventType: "RECORDING_FILE_MISSING",
                toStatus: "FAILED",
                message: "The recording file could not be fetched",
                details: { acsRecordingId: input.acsRecordingId, chunkIndex: input.chunkIndex },
            },
            new Error("event carried no contentLocation"),
        );
        return;
    }

    try {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const baseName = `${reference}-${stamp}-chunk${input.chunkIndex}`;

        const stored = await storeInParts(input.contentLocation, baseName);
        await recordingRepo.markStored(recording, stored);

        trace("meeting-rec", reference, "stored", {
            fileName: stored.fileName,
            sizeBytes: stored.sizeBytes,
            parts: stored.parts.length,
            key: stored.storagePath,
        });
        emitRecordingState(reference, { status: "STORED" });
        await recordEvent(scope, {
            track: "MEETING_RECORDING",
            provider: "SYSTEM",
            eventType: "RECORDING_STORED",
            toStatus: "STORED",
            message: "Recording saved",
            details: {
                recordingId: Number(recording.meeting_recording_id),
                chunkIndex: input.chunkIndex,
                fileName: stored.fileName,
                sizeBytes: stored.sizeBytes,
                parts: stored.parts.length,
            },
        });

        // The first chunk is the one the application points at, so a later one cannot steal it.
        if (input.chunkIndex === 0) {
            await applications.linkRecording(recording.meeting_session_id, recording.meeting_recording_id);
        }

        const call = await interviewCall
            .findLatestCall({
                companyId: Number(recording.company_id),
                meetingSessionId: recording.meeting_session_id,
            })
            .catch(() => null);

        if (call) {
            await interviewCall
                .attachRecording(Number(recording.company_id), Number(call.interview_call_id), {
                    recordingId: String(recording.meeting_recording_id),
                    bucket: Env.virtualAvatar.VA_FILE_SERVICE_BUCKET,
                    key: stored.storagePath,
                    status: "stored",
                })
                .catch(async (error) => {
                    traceFailure("meeting-rec", reference, "attach-call", error);
                    await recordFailure(
                        { ...scope, interviewCallId: Number(call.interview_call_id) },
                        {
                            track: "MEETING_RECORDING",
                            provider: "SYSTEM",
                            eventType: "RECORDING_ATTACH_FAILED",
                            message: "The saved recording could not be linked to the interview",
                            details: { recordingId: Number(recording.meeting_recording_id) },
                        },
                        error,
                    );
                });
        }
        if (input.deleteLocation) {
            await acs.deleteRecording(input.deleteLocation).catch(async (error) => {
                traceFailure("meeting-rec", reference, "delete-remote", error);
                await recordFailure(
                    scope,
                    {
                        track: "MEETING_RECORDING",
                        provider: "ACS",
                        eventType: "REMOTE_RECORDING_DELETE_FAILED",
                        message: "The original recording could not be removed from Azure",
                        details: { acsRecordingId: input.acsRecordingId },
                    },
                    error,
                );
            });
        }
    } catch (error) {
        traceFailure("meeting-rec", reference, "store", error);
        await recordingRepo.markFailed(
            recording,
            error instanceof Error ? error.message : "download or upload failed",
        );
        await recordFailure(
            scope,
            {
                track: "MEETING_RECORDING",
                provider: "SYSTEM",
                eventType: "RECORDING_STORE_FAILED",
                toStatus: "FAILED",
                message: "The recording could not be saved",
                details: { recordingId: Number(recording.meeting_recording_id), chunkIndex: input.chunkIndex },
            },
            error,
        );
    }
};

export const listForMeeting = async (
    meeting: MeetingSession,
): Promise<IMeetingRecordingView[]> => {
    const rows = await recordingRepo.listForMeeting(meeting.meeting_session_id);
    return rows.map((row) => toView(row, meeting.uuid));
};

const linkOf = async (
    row: MeetingRecording,
    reference: string,
    expiresInSeconds: number,
): Promise<IMeetingRecordingLink> => {
    const view = toView(row, reference);
    if (row.storage_kind !== "gateway" || row.status !== "STORED") {
        return { ...view, signedUrl: null, expiresAt: null };
    }

    const { url, expiresAt } = await presignStoredRecording(row, expiresInSeconds);
    return {
        ...view,
        signedUrl: url,
        expiresAt: new Date((expiresAt ?? Math.floor(Date.now() / 1000) + expiresInSeconds) * 1000).toISOString(),
    };
};

export const signedUrlForRecording = async (
    companyId: number,
    recordingId: number,
    expiresInSeconds: number,
): Promise<IMeetingRecordingLink> => {
    const row = await findStoredFile(companyId, recordingId);
    const meeting = await meetingRepo.findById(row.meeting_session_id);
    return linkOf(row, meeting?.uuid ?? String(row.meeting_session_id), expiresInSeconds);
};

export const signedUrlsForMeeting = async (
    meeting: MeetingSession,
    expiresInSeconds: number,
): Promise<IMeetingRecordingLink[]> => {
    const rows = await recordingRepo.listForMeeting(meeting.meeting_session_id);
    return Promise.all(rows.map((row) => linkOf(row, meeting.uuid, expiresInSeconds)));
};

export const findStoredFile = async (
    companyId: number,
    recordingId: number,
): Promise<MeetingRecording> => {
    const recording = await recordingRepo.findById(recordingId);
    if (!recording || Number(recording.company_id) !== companyId) {
        throw new Error(`No meeting recording ${recordingId} for company ${companyId}`);
    }
    if (recording.status !== "STORED") {
        throw new Error(`Conflict: recording ${recordingId} is ${recording.status}, not stored yet`);
    }
    return recording;
};

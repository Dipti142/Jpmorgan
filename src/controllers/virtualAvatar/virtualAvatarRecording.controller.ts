import axios from "axios";
import { Request, Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Env } from "../../config/env.config";
import { handle, validate } from "../../helpers/controller.helper";
import { trace } from "../../helpers/trace.helper";
import MeetingRecording from "../../models/meetingRecording.model";
import * as recordingRepo from "../../repositories/meeting/meetingRecording.repository";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import * as recording from "../../services/meeting/meetingRecording.service";
import { requireMeeting } from "../../services/meeting/meetingSession.service";
import * as transcript from "../../services/meeting/meetingTranscript.service";
import { presignStoredRecording } from "../../services/virtualAvatar/recordingStorage.service";
import {
    acsEventSchema,
    recordingParamsSchema,
    sessionParamsSchema,
    sessionQuerySchema,
    signedUrlQuerySchema,
} from "../../validators/virtualAvatar.validator";

const RECORDING_FILE_STATUS = "Microsoft.Communication.RecordingFileStatusUpdated";
const SUBSCRIPTION_VALIDATION = "Microsoft.EventGrid.SubscriptionValidationEvent";
const TRANSCRIPTION_FAILED = "Microsoft.Communication.TranscriptionFailed";

export class VirtualAvatarRecordingController {
    public static readonly getRecordings = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(sessionQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);

        const meeting = await meetingRepo.findByUuid(sessionReference);
        if (!meeting || Number(meeting.company_id) !== companyId) {
            throw new Error(`No meeting ${sessionReference} for company ${companyId}`);
        }

        const recordings = await recording.listForMeeting(meeting);

        return res.successResponse({ recordings });
    });

    public static readonly getSessionSignedUrls = handle(async (req: Request, res: Response) => {
        const { companyId, expiresIn } = validate(signedUrlQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);

        const meeting = /^\d+$/.test(sessionReference)
            ? await meetingRepo.findById(Number(sessionReference))
            : await meetingRepo.findByUuid(sessionReference);

        if (!meeting || Number(meeting.company_id) !== companyId) {
            throw new Error(`No meeting ${sessionReference} for company ${companyId}`);
        }

        const ttl = expiresIn ?? Env.virtualAvatar.VA_RECORDING_URL_TTL_SECONDS;
        return res.successResponse({
            sessionReference: meeting.uuid,
            expiresIn: ttl,
            recordings: await recording.signedUrlsForMeeting(meeting, ttl),
        });
    });

    public static readonly getRecordingSignedUrl = handle(async (req: Request, res: Response) => {
        const { recordingId } = validate(recordingParamsSchema, req.params);
        const { companyId, expiresIn } = validate(signedUrlQuerySchema, req.query);

        const ttl = expiresIn ?? Env.virtualAvatar.VA_RECORDING_URL_TTL_SECONDS;
        return res.successResponse({
            expiresIn: ttl,
            recording: await recording.signedUrlForRecording(companyId, recordingId, ttl),
        });
    });
    public static readonly getRecordingFile = handle(async (req: Request, res: Response) => {
        const { recordingId } = validate(recordingParamsSchema, req.params);
        const { companyId } = validate(sessionQuerySchema, req.query);

        const row = await recording.findStoredFile(companyId, recordingId);
        return res.redirect(302, (await presignStoredRecording(row)).url);
    });

   
    public static readonly streamRecording = handle(async (req: Request, res: Response) => {
        const { recordingId } = validate(recordingParamsSchema, req.params);
        const { companyId } = validate(sessionQuerySchema, req.query);

        const row = await recording.findStoredFile(companyId, recordingId);
        return VirtualAvatarRecordingController.sendRecording(req, res, row, "inline");
    });

    public static readonly downloadSessionRecording = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(sessionQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);

        const meeting = await requireMeeting(companyId, sessionReference);
        const row = (await recordingRepo.listForMeeting(meeting.meeting_session_id))
            .filter((stored) => stored.status === "STORED")
            .at(-1);
        if (!row) throw new Error(`Conflict: no recording of meeting ${meeting.uuid} is stored yet`);

        return VirtualAvatarRecordingController.sendRecording(req, res, row, "attachment");
    });

    private static async sendRecording(
        req: Request,
        res: Response,
        row: MeetingRecording,
        disposition: "inline" | "attachment",
    ) {
        const recordingId = row.meeting_recording_id;
        const { parts, total } = recording.partsOf(row);

        const asked = req.headers.range;
        const bounds = /^bytes=(\d*)-(\d*)$/.exec(asked ?? "");
        let start = 0;
        let end = total - 1;

        if (asked) {
            if (!bounds || (!bounds[1] && !bounds[2])) {
                return res.status(416).set("Content-Range", `bytes */${total}`).end();
            }
            if (bounds[1]) {
                start = Number(bounds[1]);
                end = bounds[2] ? Math.min(Number(bounds[2]), total - 1) : total - 1;
            } else {
                start = Math.max(total - Number(bounds[2]), 0);
            }
            if (start > end || start >= total) {
                return res.status(416).set("Content-Range", `bytes */${total}`).end();
            }
        }

        res.status(asked ? 206 : 200).set({
            "Accept-Ranges": "bytes",
            "Content-Type": "video/mp4",
            "Content-Length": String(end - start + 1),
            "Content-Disposition": `${disposition}; filename="${row.file_name ?? `recording-${recordingId}.mp4`}"`,
            "Cross-Origin-Resource-Policy": "cross-origin",
            ...(asked ? { "Content-Range": `bytes ${start}-${end}/${total}` } : {}),
        });

        if (req.method === "HEAD") return res.end();

        try {
            for (const part of parts) {
                const from = Math.max(start, part.offset);
                const to = Math.min(end, part.offset + part.sizeBytes - 1);
                if (from > to || res.destroyed) continue;

                const { url } = await presignStoredRecording({
                    storage_kind: row.storage_kind,
                    storage_path: part.path,
                });
                const slice = await axios.get<Readable>(url, {
                    responseType: "stream",
                    headers: { Range: `bytes=${from - part.offset}-${to - part.offset}` },
                });

                // end: false - the response stays open until the last part has gone out.
                await pipeline(slice.data, res, { end: false });
            }
            return res.end();
        } catch (error) {
            // Headers are already out, so there is no error envelope to send - drop the socket.
            trace("va-rec", String(recordingId), "stream-aborted", {
                reason: error instanceof Error ? error.message : "unknown",
            });
            return res.destroy();
        }
    }


    public static readonly postCallEvents = handle(async (req: Request, res: Response) => {
        const events = validate(acsEventSchema, Array.isArray(req.body) ? req.body : [req.body]);
        console.log("Appeared at recording screen")
        for (const event of events) {
            if (event.eventType === SUBSCRIPTION_VALIDATION) {
                console.log("validation recording")
                trace("va-rec", "eventgrid", "handshake");
                return res.status(200).json({ validationResponse: event.data?.validationCode });
            }
        }

        res.status(202).end();

        for (const event of events) {
            if (event.type === TRANSCRIPTION_FAILED && event.data?.callConnectionId) {
                await transcript
                    .markFailed(event.data.callConnectionId, event.data.resultInformation?.message ?? "unknown")
                    .catch(() => undefined);
                continue;
            }
            if (event.eventType !== RECORDING_FILE_STATUS) continue;
            console.log("recording started")
            const acsRecordingId = event.subject?.split("/recordingId/")[1];
            if (!acsRecordingId) continue;

            const chunks = event.data?.recordingStorageInfo?.recordingChunks ?? [];
            trace("va-rec", "eventgrid", "file-event", { acsRecordingId, chunks: chunks.length });

            // Sequential: each chunk is its own row, and two of them racing on the
            // same recording id is what used to leave all but one object orphaned.
            for (const [position, chunk] of chunks.entries()) {
                await recording
                    .handleFileReady({
                        acsRecordingId,
                        chunkIndex: chunk.index ?? position,
                        contentLocation: chunk.contentLocation ?? null,
                        metadataLocation: chunk.metadataLocation ?? null,
                        deleteLocation: chunk.deleteLocation ?? null,
                        eventPayload: event as Record<string, unknown>,
                    })
                    .catch(() => undefined);
            }
        }

        return undefined;
    });
}

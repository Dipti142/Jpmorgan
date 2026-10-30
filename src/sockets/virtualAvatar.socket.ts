import { Server as HttpServer } from "node:http";
import { Socket } from "socket.io";
import { getSocketServer, initSocketServer } from "../config/socket.config";
import { IMeetingLobbyEntry, IMeetingTranscriptLine, MeetingTranscriptionStatus } from "../interfaces/IMeeting.interface";
import * as meetingRepo from "../repositories/meeting/meetingSession.repository";
import { trace, traceFailure } from "../helpers/trace.helper";

/**
 * The lobby transport.
 *
 * The socket carries the signal only. Credentials are always fetched over HTTPS
 * from /v1/va/join/claim, so an ACS token never rides a socket frame and a
 * dropped connection degrades to a poll rather than losing the call.
 */

export const VA_EVENTS = {
    lobbyWaiting: "va:lobby_waiting",
    admission: "va:admission",
    participantJoined: "va:participant_joined",
    participantLeft: "va:participant_left",
    recordingState: "va:recording_state",
    sessionEnded: "va:session_ended",
    transcript: "va:transcript",
    transcriptPartial: "va:transcript_partial",
    transcriptionState: "va:transcription_state",
    agendaFocus: "va:agenda_focus",
    agendaUpdated: "va:agenda_updated",
} as const;

const sessionRoom = (reference: string): string => `va:${reference}`;
const organiserRoom = (reference: string): string => `va:${reference}:organisers`;
// Whoever may read the call agenda - never the session room, the candidate must not see answers or scores.
const agendaRoom = (reference: string): string => `va:${reference}:agenda`;
const participantRoom = (participantId: number): string => `va:participant:${participantId}`;

/**
 * The invite token is the whole credential - it names the meeting and the holder,
 * so nothing else is accepted. Verified before any room is joined, or knowing a
 * session reference would be enough to watch its lobby.
 */
const authorise = async (socket: Socket): Promise<void> => {
    const { ref } = (socket.handshake.auth ?? {}) as { ref?: string };
    if (!ref || typeof ref !== "string") throw new Error("ref is required");

    const participant = await meetingRepo.findBySessionToken(ref);
    if (!participant) throw new Error("unknown invite");

    const meeting = await meetingRepo.findById(participant.meeting_session_id);
    if (!meeting) throw new Error("unknown session");

    const reference = meeting.uuid;
    const participantId = Number(participant.meeting_participant_id);

    await socket.join(participantRoom(participantId));

    if (participant.admission_state === "ADMITTED") {
        await socket.join(sessionRoom(reference));
        if (participant.role === "ORGANIZER") {
            await socket.join(organiserRoom(reference));
        }
        if (participant.role === "ORGANIZER" || participant.role === "AGENT") {
            await socket.join(agendaRoom(reference));
        }
    } else if (participant.admission_state !== "PENDING" && participant.admission_state !== "INVITED") {
        throw new Error("participant is not in this call");
    }

    socket.data.sessionReference = reference;
    socket.data.participantId = participantId;
    socket.data.role = participant.role;
};

export const attachVirtualAvatarSocket = (httpServer: HttpServer): void => {
    const io = initSocketServer(httpServer);

    io.use((socket, next) => {
        authorise(socket)
            .then(() => next())
            .catch((error: Error) => {
                traceFailure("va-socket", "handshake", "rejected", error);
                next(error);
            });
    });

    io.on("connection", (socket) => {
        trace("va-socket", String(socket.data.sessionReference ?? "?"), "connected", {
            participantId: socket.data.participantId,
            role: socket.data.role,
        });
    });
};

/* -- emitting ------------------------------------------------------------- */

const emit = (room: string, event: string, payload: unknown): void => {
    const io = getSocketServer();
    if (!io) return;
    io.to(room).emit(event, payload);
};

export const emitLobbyWaiting = (reference: string, entry: IMeetingLobbyEntry): void =>
    emit(organiserRoom(reference), VA_EVENTS.lobbyWaiting, entry);

export const emitAdmission = (
    participantId: number,
    payload: { decision: "ADMITTED" | "DENIED"; reason?: string },
): void => emit(participantRoom(participantId), VA_EVENTS.admission, payload);

export const emitParticipantJoined = (
    reference: string,
    payload: { participantId: number; displayName: string; role: string },
): void => emit(sessionRoom(reference), VA_EVENTS.participantJoined, payload);

export const emitParticipantLeft = (
    reference: string,
    payload: { participantId: number; displayName: string },
): void => emit(sessionRoom(reference), VA_EVENTS.participantLeft, payload);

export const emitRecordingState = (reference: string, payload: { status: string }): void =>
    emit(sessionRoom(reference), VA_EVENTS.recordingState, payload);

export const emitSessionEnded = (reference: string, payload: { reason: string | null }): void =>
    emit(sessionRoom(reference), VA_EVENTS.sessionEnded, payload);

export const emitTranscript = (reference: string, line: IMeetingTranscriptLine): void =>
    emit(sessionRoom(reference), VA_EVENTS.transcript, line);

export const emitTranscriptPartial = (
    reference: string,
    payload: { participantId: number | null; speakerName: string; language: string; text: string },
): void => emit(sessionRoom(reference), VA_EVENTS.transcriptPartial, payload);

export const emitTranscriptionState = (
    reference: string,
    payload: { status: MeetingTranscriptionStatus | null; language: string },
): void => emit(sessionRoom(reference), VA_EVENTS.transcriptionState, payload);

export const emitAgendaFocus = (reference: string, payload: { questionKey: string }): void =>
    emit(agendaRoom(reference), VA_EVENTS.agendaFocus, payload);

export const emitAgendaUpdated = (
    reference: string,
    payload: {
        key: string;
        kind: string;
        recorded: { choice: "yes" | "no" | null; answer: string | null; score: number | null };
    },
): void => emit(agendaRoom(reference), VA_EVENTS.agendaUpdated, payload);

import { translatorApi, ttsApi } from "../../config/axios.config";
import { Env } from "../../config/env.config";
import { callName } from "../../helpers/meeting.helper";
import { trace, traceFailure } from "../../helpers/trace.helper";
import { IMeetingTranscriptLine, IMeetingTranscriptView, MeetingTranscriptionStatus } from "../../interfaces/IMeeting.interface";
import MeetingParticipant from "../../models/meetingParticipant.model";
import MeetingSession from "../../models/meetingSession.model";
import MeetingTranscript from "../../models/meetingTranscript.model";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import * as transcriptRepo from "../../repositories/meeting/meetingTranscript.repository";
import { emitTranscript, emitTranscriptPartial, emitTranscriptionState } from "../../sockets/virtualAvatar.socket";
import * as acs from "../acs/acsRecording.service";
import { requireMeeting } from "./meetingSession.service";

const TRANSCRIPT_LANGUAGES = [
    { code: "en", label: "English", locale: "en-US", voice: "en-US-AvaNeural" },
    { code: "es", label: "Spanish", locale: "es-MX", voice: "es-MX-DaliaNeural" },
    { code: "pt", label: "Portuguese", locale: "pt-BR", voice: "pt-BR-FranciscaNeural" },
    { code: "fr", label: "French", locale: "fr-FR", voice: "fr-FR-DeniseNeural" },
    { code: "zh-Hans", label: "Chinese (Simplified)", locale: "zh-CN", voice: "zh-CN-XiaoxiaoNeural" },
    { code: "ar", label: "Arabic", locale: "ar-SA", voice: "ar-SA-ZariyahNeural" },
    { code: "ru", label: "Russian", locale: "ru-RU", voice: "ru-RU-SvetlanaNeural" },
    { code: "vi", label: "Vietnamese", locale: "vi-VN", voice: "vi-VN-HoaiMyNeural" },
    { code: "hi", label: "Hindi", locale: "hi-IN", voice: "hi-IN-SwaraNeural" },
];

const TRANSLATE_BATCH = 100;

const languageOf = (code: string) => {
    const language = TRANSCRIPT_LANGUAGES.find((entry) => entry.code === code);
    if (!language) throw new Error(`Conflict: ${code} is not a supported transcript language`);
    return language;
};

const spokenLanguage = (meeting: MeetingSession): string =>
    meeting.transcription_language ?? Env.virtualAvatar.VA_TRANSCRIPTION_LANGUAGE;

export const spokenLocale = (meeting: MeetingSession): string => languageOf(spokenLanguage(meeting)).locale;

const translate = async (texts: string[], from: string, to: string[]): Promise<Record<string, string>[]> => {
    if (!to.length) return texts.map(() => ({}));

    const { data } = await translatorApi.post<{ translations: { text: string; to: string }[] }[]>(
        "/translate",
        texts.map((text) => ({ Text: text })),
        { params: { "api-version": "3.0", from, to } },
    );
    return data.map((result) => Object.fromEntries(result.translations.map((entry) => [entry.to, entry.text])));
};

const lineView = (line: MeetingTranscript): IMeetingTranscriptLine => ({
    lineId: Number(line.meeting_transcript_id),
    participantId: line.meeting_participant_id === null ? null : Number(line.meeting_participant_id),
    speakerName: line.speaker_name,
    language: line.language,
    text: line.text,
    translations: line.translations ?? {},
    at: line.created_ts.toISOString(),
});

const setState = async (
    meeting: MeetingSession,
    input: { status?: MeetingTranscriptionStatus; language?: string },
): Promise<{ status: MeetingTranscriptionStatus | null; language: string }> => {
    await meetingRepo.setTranscription(meeting, input);
    const state = { status: meeting.transcription_status, language: spokenLanguage(meeting) };
    trace("meeting-transcript", meeting.uuid, "state", state);
    emitTranscriptionState(meeting.uuid, state);
    return state;
};

export const startForMeeting = async (meeting: MeetingSession, callConnectionId: string): Promise<void> => {
    if (meeting.transcription_status === "PAUSED") {
        trace("meeting-transcript", meeting.uuid, "skipped", { reason: "paused" });
        return;
    }

    try {
        await acs.startTranscription(callConnectionId, spokenLocale(meeting));
        await setState(meeting, { status: "ACTIVE" });
    } catch (error) {
        traceFailure("meeting-transcript", meeting.uuid, "start", error);
        await setState(meeting, { status: "FAILED" });
    }
};

export const control = async (
    meeting: MeetingSession,
    input: { status?: "ACTIVE" | "PAUSED"; language?: string },
): Promise<{ status: MeetingTranscriptionStatus | null; language: string }> => {
    const callConnectionId = meeting.call_connection_id;
    if (!callConnectionId || !(await acs.isConnected(callConnectionId))) {
        throw new Error("Unavailable: transcription is not connected to this call");
    }

    const language = languageOf(input.language ?? spokenLanguage(meeting));
    const active = meeting.transcription_status === "ACTIVE";

    if (input.status === "ACTIVE" && !active) {
        await acs.startTranscription(callConnectionId, language.locale);
    } else if (input.status === "PAUSED" && active) {
        await acs.stopTranscription(callConnectionId);
    } else if (active && language.code !== spokenLanguage(meeting)) {
        await acs.updateTranscription(callConnectionId, language.locale);
    }

    return setState(meeting, { status: input.status, language: language.code });
};

export const setLanguage = async (
    participant: MeetingParticipant,
    language: string | null,
): Promise<{ language: string | null }> => {
    const code = language === null ? null : languageOf(language).code;
    await meetingRepo.setTranscriptLanguage(participant, code);
    return { language: code };
};

export const history = async (meeting: MeetingSession, participant: MeetingParticipant | null) => {
    const listener = participant?.transcript_language ?? null;
    const lines = await transcriptRepo.listForMeeting(meeting.meeting_session_id);
    const missing = listener ? lines.filter((line) => line.language !== listener && !line.translations?.[listener]) : [];

    try {
        for (const from of new Set(missing.map((line) => line.language))) {
            const group = missing.filter((line) => line.language === from);
            for (let index = 0; index < group.length; index += TRANSLATE_BATCH) {
                const batch = group.slice(index, index + TRANSLATE_BATCH);
                const results = await translate(batch.map((line) => line.text), from, [listener!]);
                await Promise.all(
                    batch.map((line, position) =>
                        transcriptRepo.setTranslations(line, { ...line.translations, ...results[position] }),
                    ),
                );
            }
        }
    } catch (error) {
        traceFailure("meeting-transcript", meeting.uuid, "backfill", error);
    }

    return {
        transcription: { status: meeting.transcription_status, language: spokenLanguage(meeting) },
        listenerLanguage: listener,
        languages: TRANSCRIPT_LANGUAGES.map(({ code, label }) => ({ code, label })),
        lines: lines.map(lineView),
    };
};

export const getMeetingTranscript = async (companyId: number, reference: string): Promise<IMeetingTranscriptView> => {
    const meeting = await requireMeeting(companyId, reference);
    const meetingSessionId = Number(meeting.meeting_session_id);
    const lines = await transcriptRepo.listForMeeting(meetingSessionId);
    const participants = await meetingRepo.findParticipants(meetingSessionId);
    const roleById = new Map(participants.map((participant) => [Number(participant.meeting_participant_id), participant.role]));

    const startedAt = meeting.first_joined_ts ?? lines[0]?.created_ts ?? null;

    return {
        sessionReference: meeting.uuid,
        startedAt: startedAt?.toISOString() ?? null,
        total: lines.length,
        lines: lines.map((line) => ({
            ...lineView(line),
            speakerRole: line.meeting_participant_id === null ? null : (roleById.get(Number(line.meeting_participant_id)) ?? null),
            offsetSeconds: startedAt ? Math.max(Math.round((line.created_ts.getTime() - startedAt.getTime()) / 1000), 0) : 0,
        })),
    };
};

export const speech = async (
    meeting: MeetingSession,
    participant: MeetingParticipant | null,
    lineId: number,
): Promise<Buffer> => {
    const line = await transcriptRepo.findLine(meeting.meeting_session_id, lineId);
    if (!line) throw new Error(`No transcript line ${lineId}`);

    const target = participant?.transcript_language;
    const translated = target ? line.translations?.[target] : undefined;
    const { locale, voice } = languageOf(translated ? target! : line.language);
    const text = (translated ?? line.text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const { data } = await ttsApi.post<ArrayBuffer>(
        "/cognitiveservices/v1",
        `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">${text}</voice></speak>`,
    );
    return Buffer.from(data);
};

export const markFailed = async (callConnectionId: string, reason: string): Promise<void> => {
    const meeting = await meetingRepo.findByCallConnectionId(callConnectionId);
    if (!meeting) return;

    trace("meeting-transcript", meeting.uuid, "acs-failed", { reason });
    await setState(meeting, { status: "FAILED" });
};

export const openStream = (): { push: (raw: string) => void; close: () => void } => {
    let meeting: MeetingSession | null = null;
    let participants: MeetingParticipant[] = [];
    let queue = Promise.resolve();

    const handle = async (raw: string): Promise<void> => {
        const frame = JSON.parse(raw) as {
            kind?: string;
            transcriptionMetadata?: { callConnectionId?: string };
            transcriptionData?: { text?: string; participantRawID?: string; resultStatus?: string };
        };

        if (frame.kind === "TranscriptionMetadata") {
            const callConnectionId = frame.transcriptionMetadata?.callConnectionId ?? "";
            meeting = await meetingRepo.findByCallConnectionId(callConnectionId);
            if (meeting) participants = await meetingRepo.findParticipants(meeting.meeting_session_id);
            trace("meeting-transcript", meeting?.uuid ?? "?", "stream-open", { callConnectionId });
            return;
        }

        const data = frame.transcriptionData;
        if (frame.kind !== "TranscriptionData" || !meeting || !data?.text) return;

        const rawId = data.participantRawID ?? "";
        const final = data.resultStatus?.toLowerCase() === "final";
        if (final) meeting = (await meetingRepo.findById(meeting.meeting_session_id)) ?? meeting;
        if (final || !participants.some((participant) => participant.acs_user_id === rawId)) {
            participants = await meetingRepo.findParticipants(meeting.meeting_session_id);
        }

        const speaker = participants.find((participant) => participant.acs_user_id === rawId) ?? null;
        const participantId = speaker ? Number(speaker.meeting_participant_id) : null;
        const speakerName = callName(speaker);
        const language = spokenLanguage(meeting);

        if (!final) {
            emitTranscriptPartial(meeting.uuid, { participantId, speakerName, language, text: data.text });
            return;
        }

        const targets = [
            ...new Set(
                participants
                    .filter((participant) => participant.admission_state === "ADMITTED")
                    .map((participant) => participant.transcript_language)
                    .filter((code): code is string => !!code && code !== language),
            ),
        ];
        const reference = meeting.uuid;
        const [translations] = await translate([data.text], language, targets).catch((error) => {
            traceFailure("meeting-transcript", reference, "translate", error);
            return [{}];
        });

        const line = await transcriptRepo.createLine({
            meetingSessionId: meeting.meeting_session_id,
            participantId,
            speakerName,
            language,
            text: data.text,
            translations,
        });
        emitTranscript(meeting.uuid, lineView(line));
    };

    return {
        push: (raw) => {
            queue = queue
                .then(() => handle(raw))
                .catch((error) => traceFailure("meeting-transcript", meeting?.uuid ?? "?", "frame", error));
        },
        close: () => trace("meeting-transcript", meeting?.uuid ?? "?", "stream-closed"),
    };
};

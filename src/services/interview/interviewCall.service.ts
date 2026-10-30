import { createHash } from "node:crypto";
import {
    IAnamTranscriptTurn,
} from "../../interfaces/IAnamMeeting.interface";
import {
    ICallAnswerView,
    ICallFailureInput,
    ICallParticipant,
    ICallTurnInput,
    ICallTurnView,
    IInterviewCallView,
    ISessionEscalationsView,
    InterviewCallFailureCode,
    InterviewCallSpeaker,
    InterviewCallStatus,
} from "../../interfaces/IInterviewCall.interface";
import { EVALUATION_BANDS } from "../../constants/interview/interview.tools";
import { errorMessageOf, redactDetails } from "../../helpers/meetingHistory.helper";
import { maskEmail, maskPhone } from "../../helpers/speech.helper";
import { traceFailure } from "../../helpers/trace.helper";
import InterviewCall from "../../models/interviewCall.model";
import InterviewCallTurn from "../../models/interviewCallTurn.model";
import Candidate from "../../models/candidate.model";
import MeetingParticipant from "../../models/meetingParticipant.model";
import * as repository from "../../repositories/interview/interviewCall.repository";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import { recordFailure } from "../meeting/meetingHistory.service";


export const hashScript = (systemPrompt: string): string =>
    createHash("sha256").update(systemPrompt, "utf8").digest("hex").slice(0, 64);

export const candidateSnapshot = (participant: MeetingParticipant, candidate: Candidate | null) => ({
    candidateName: candidate?.name ?? participant.display_name,
    candidateEmail: candidate?.email ?? participant.email,
    candidatePhone: candidate?.phone ?? null,
    atsSystem: candidate ? "workable" : null,
    atsCandidateId: candidate?.candidate_id ?? null,
});

export const openCall = repository.openCall;
export const updateCall = repository.updateCall;
export const findOpenCall = repository.findOpenCall;
export const findLatestCall = repository.findLatestCall;
export const findCallByReference = repository.findCallByReference;
export const generateReference = repository.generateReference;
export const recordKnowledgeLookup = repository.recordKnowledgeLookup;
export const readAnswers = repository.readAnswers;
export const upsertAnswer = repository.upsertAnswer;
export const saveRawTranscript = repository.saveRawTranscript;
export const appendAnswerHistory = repository.appendAnswerHistory;
export const countAsks = repository.countAsks;
export const countToolCalls = repository.countToolCalls;
export const countSectionIntros = repository.countSectionIntros;
export const appendEscalation = repository.appendEscalation;

export const closeCall = async (
    call: InterviewCall,
    status: InterviewCallStatus,
    detail: { failureCode?: InterviewCallFailureCode; failureReason?: string; endedTs?: Date } = {},
): Promise<InterviewCall> => {
    if (call.ended_ts) return call;

    return repository.updateCall(call, {
        callStatus: status,
        endedTs: detail.endedTs ?? new Date(),
        ...(detail.failureCode === undefined ? {} : { failureCode: detail.failureCode }),
        ...(detail.failureReason === undefined ? {} : { failureReason: detail.failureReason }),
    });
};

export const recordCallFailure = async (call: InterviewCall, failure: ICallFailureInput): Promise<void> => {
    try {
        const at = new Date();
        const message = failure.error === undefined ? failure.reason : errorMessageOf(failure.error);

        await repository.updateCall(call, {
            failureCode: failure.code,
            failureReason: errorMessageOf(failure.reason),
            errorPayload: redactDetails({ stage: failure.stage, code: failure.code, message, ...failure.detail }),
            ...(failure.declined ? { declinedTs: call.declined_ts ?? at } : {}),
            ...(failure.closeAs && !call.ended_ts ? { callStatus: failure.closeAs, endedTs: at } : {}),
        });

        await recordFailure(
            {
                companyId: Number(call.company_id),
                meetingSessionId: Number(call.meeting_session_id),
                interviewCallId: Number(call.interview_call_id),
                reference: call.interview_reference,
            },
            {
                track: "AI_INTERVIEWER",
                provider: "SYSTEM",
                eventType: `CALL_${failure.code}`,
                message: failure.reason,
                details: { stage: failure.stage, attemptNo: call.attempt_no },
            },
            failure.error ?? new Error(failure.reason),
        );
    } catch (error) {
        traceFailure("call", call.interview_reference, "record-failure", error);
    }
};

export const recordOpenCallFailure = async (
    companyId: number,
    meetingSessionId: number,
    failure: ICallFailureInput,
): Promise<void> => {
    try {
        const call = await repository.findOpenCall({ companyId, meetingSessionId });
        if (call) await recordCallFailure(call, failure);
    } catch (error) {
        traceFailure("call", String(meetingSessionId), "find-open-call", error);
    }
};

export const recordInterruption = async (companyId: number, meetingSessionId: number): Promise<void> => {
    try {
        const call = await repository.findOpenCall({ companyId, meetingSessionId });
        if (!call) return;

        await repository.recordInterruption(call);
        await recordCallFailure(call, {
            code: "AGENT_LEFT_EARLY",
            reason: "The interviewer left before the interview was submitted",
            stage: "agent-left",
        });
    } catch (error) {
        traceFailure("call", String(meetingSessionId), "record-interruption", error);
    }
};

export const markPersonaJoined = async (call: InterviewCall): Promise<void> => {
    if (call.joined_ts) return;
    await repository.updateCall(call, { joinedTs: new Date() });
};


export const outcomeOf = (
    meetingStatus: string | null,
    joinState: string | null,
): InterviewCallStatus | null => {
    if (meetingStatus === "failed") return joinState === "in_call" ? "INTERRUPTED" : "FAILED_TO_JOIN";
    if (meetingStatus === "cancelled") return "CANCELLED";
    if (meetingStatus === "ended") return joinState === "in_call" || joinState === "left" ? "COMPLETED" : "NO_ANSWER";
    return null;
};

const speakerOf = (role: string | undefined): ICallTurnInput["role"] => {
    const value = String(role ?? "").toLowerCase();
    if (value === "persona" || value === "assistant" || value === "ai") return "persona";
    if (value === "user" || value === "candidate" || value === "human") return "candidate";
    return "system";
};

const speakerLabelOf = (turn: IAnamTranscriptTurn): string | null => {
    const value = turn.speakerName ?? turn.participantName ?? turn.speaker ?? turn.participant;
    const label = String(value ?? "").trim();
    if (!label.length || ["user", "assistant", "ai", "persona", "human", "system"].includes(label.toLowerCase())) {
        return null;
    }
    return label.slice(0, 150);
};


const languageCodeOf = (turn: IAnamTranscriptTurn): string | null => {
    const value = turn.languageCode ?? turn.language ?? turn.lang ?? turn.locale;
    const code = String(value ?? "").trim();
    return code.length ? code : null;
};

// A malformed or missing timestamp is stored as null rather than "now" - a
// guessed time is worse than no time for lining turns up with a recording.
const spokenTsOf = (turn: IAnamTranscriptTurn): Date | null => {
    if (!turn.timestamp) return null;
    const parsed = new Date(turn.timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};


const languageNameOf = (code: string | null): string | null => {
    if (!code) return null;
    try {
        return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
    } catch {
        return code;
    }
};

const samePerson = (a: string | null, b: string | null): boolean => {
    const left = String(a ?? "").trim().toLowerCase();
    const right = String(b ?? "").trim().toLowerCase();
    if (!left || !right) return false;
    return left === right || left.startsWith(right) || right.startsWith(left);
};


const roleOf = (call: InterviewCall, turn: IAnamTranscriptTurn, label: string | null): InterviewCallSpeaker => {
    const byRole = speakerOf(turn.role);
    if (byRole === "persona" || byRole === "system") return byRole;
    if (!label) return byRole;

    if (samePerson(label, call.avatar_display_name)) return "persona";
    if (samePerson(label, call.candidate_name)) return "candidate";
    return "guest";
};

const rosterFrom = (call: InterviewCall, turns: ICallTurnInput[]): ICallParticipant[] => {
    const roster = new Map<string, ICallParticipant>();
    for (const existing of call.participants ?? []) {
        roster.set(existing.name.toLowerCase(), { ...existing, turns: 0 });
    }
    for (const turn of turns) {
        if (turn.role === "system") continue;
        const name =
            turn.speakerLabel ??
            (turn.role === "persona" ? call.avatar_display_name : call.candidate_name) ??
            null;
        if (!name) continue;
        const key = name.toLowerCase();
        const found = roster.get(key);
        if (found) {
            found.turns += 1;
            continue;
        }
        roster.set(key, {
            role: turn.role,
            name,
            source: "transcript",
            turns: 1,
        });
    }

    return [...roster.values()];
};

export const saveTranscript = async (
    call: InterviewCall,
    transcript: IAnamTranscriptTurn[],
    questionKey?: string | null,
): Promise<number> => {
    const turns: ICallTurnInput[] = transcript
        .map((turn) => {
            const languageCode = languageCodeOf(turn);
            const speakerLabel = speakerLabelOf(turn);

            return {
                role: roleOf(call, turn, speakerLabel),
                speakerLabel,
                content: String(turn.message ?? turn.content ?? "").trim(),
                // Per turn, because an interpreter switching language mid-call is
                // the thing being assessed, not a property of the call.
                languageCode,
                languageName: languageNameOf(languageCode),
                spokenTs: spokenTsOf(turn),
                // Anam does not currently return offsets; the columns exist so a
                // transcript can be lined up with the S3 recording when it does.
                startOffsetMs: typeof turn.startOffsetMs === "number" ? turn.startOffsetMs : null,
                endOffsetMs: typeof turn.endOffsetMs === "number" ? turn.endOffsetMs : null,
                questionKey: questionKey ?? null,
            };
        })
        .filter((turn) => turn.content.length > 0);

    // Rewritten with the transcript, not appended to, so a re-fetch cannot
    // double the turn counts or leave a guest behind who was never really there.
    await repository.updateCall(call, { participants: rosterFrom(call, turns) });

    return repository.replaceTurns(Number(call.interview_call_id), turns);
};

/* -- reading it back ------------------------------------------------------ */

/**
 * Role to a name, off the call row.
 *
 * Both names were snapshotted when the call opened, so a retired avatar or a
 * corrected candidate name never rewrites who said what on a call that already
 * happened. Only ever reached when the provider named nobody.
 */
const speakerName = (call: InterviewCall, role: ICallTurnView["role"]): string => {
    if (role === "persona") return call.avatar_display_name ?? "Interviewer";
    if (role === "candidate") return call.candidate_name ?? "Candidate";
    return "System";
};

const turnView = (call: InterviewCall, turn: InterviewCallTurn): ICallTurnView => ({
    index: turn.turn_index,
    role: turn.speaker_role,
    // The provider's label wins: it is the only thing that can tell a second
    // human in the room from the candidate.
    speaker: turn.speaker_label ?? speakerName(call, turn.speaker_role),
    speakerConfirmed: Boolean(turn.speaker_label),
    content: turn.content,
    languageCode: turn.language_code,
    languageName: turn.language_name,
    spokenAt: turn.spoken_ts ? turn.spoken_ts.toISOString() : null,
    startOffsetMs: turn.start_offset_ms,
    endOffsetMs: turn.end_offset_ms,
    questionKey: turn.question_key,
});

/** The stored transcript, in order, with every turn attributed to a person. */
export const readTranscript = async (call: InterviewCall): Promise<ICallTurnView[]> => {
    const turns = await repository.findTurns(Number(call.interview_call_id));
    return turns.map((turn) => turnView(call, turn));
};

const iso = (value: Date | null): string | null => (value ? new Date(value).toISOString() : null);

/** Masked like everywhere else - the history is read by people who also call. */
const callView = (call: InterviewCall): IInterviewCallView => ({
    id: Number(call.interview_call_id),
    reference: call.interview_reference,
    attemptNo: call.attempt_no,
    status: call.call_status,
    channel: call.channel,
    jobLabel: call.job_label,
    candidate: {
        candidateId: call.ats_candidate_id,
        name: call.candidate_name,
        emailMasked: maskEmail(call.candidate_email),
        phoneMasked: maskPhone(call.candidate_phone),
        atsSystem: call.ats_system,
        atsCandidateId: call.ats_candidate_id,
    },
    persona: {
        key: call.persona_key,
        role: call.persona_role,
        avatarKey: call.avatar_key,
        displayName: call.avatar_display_name,
        avatarModel: call.avatar_model,
        voiceId: call.voice_id,
    },
    knowledge: {
        folder: call.kb_folder,
        domain: call.kb_domain,
        lookups: call.kb_lookup_count,
    },
    participants: call.participants ?? [],
    timeline: {
        roomInitiatedAt: iso(call.room_initiated_ts),
        initiatedAt: new Date(call.initiated_ts).toISOString(),
        joinedAt: iso(call.joined_ts),
        answeredAt: iso(call.answered_ts),
        declinedAt: iso(call.declined_ts),
        submittedAt: iso(call.submitted_ts),
        endedAt: iso(call.ended_ts),
        durationSeconds: call.duration_seconds,
    },
    recording: {
        id: call.recording_id,
        status: call.recording_status,
        bucket: call.recording_bucket,
        key: call.recording_key,
        expiresAt: iso(call.recording_expires_ts),
    },
    outcome: {
        questionsTotal: call.questions_total,
        questionsAnswered: call.questions_answered,
        // DECIMAL comes back as a string from pg; a caller wanting a number
        // should not have to know that.
        averageScore: call.average_score === null ? null : Number(call.average_score),
        interruptedCount: call.interrupted_count,
        failureCode: call.failure_code,
        failureReason: call.failure_reason,
        errorPayload: call.error_payload,
    },
    scriptHash: call.script_hash,
    escalations: call.escalations ?? [],
});

export const listCalls = async (input: repository.IListCallsInput) => {
    const { rows, total } = await repository.listCalls(input);

    return {
        total,
        limit: input.limit,
        offset: input.offset,
        calls: rows.map(callView),
    };
};

/** The single call, with its transcript - the only read that returns one. */
export const getCall = async (companyId: number, interviewCallId: number): Promise<IInterviewCallView> => {
    const call = await repository.findCallById(companyId, interviewCallId);
    if (!call) throw new Error(`No call ${interviewCallId} for company ${companyId}`);

    return { ...callView(call), transcript: await readTranscript(call) };
};

/** The uuid or its numeric meeting_session_id - every session read takes either. */
const findSessionMeeting = async (sessionReference: string) =>
    /^\d+$/.test(sessionReference)
        ? meetingRepo.findById(Number(sessionReference))
        : meetingRepo.findByUuid(sessionReference);

const requireSessionMeeting = async (companyId: number, sessionReference: string) => {
    const meeting = await findSessionMeeting(sessionReference);

    if (!meeting || Number(meeting.company_id) !== companyId) {
        throw new Error(`No session ${sessionReference} for company ${companyId}`);
    }
    return meeting;
};

export const getSessionEscalations = async (
    companyId: number,
    sessionReference: string,
): Promise<ISessionEscalationsView> => {
    const meeting = await requireSessionMeeting(companyId, sessionReference);

    const calls = await repository.findCallsWithEscalations({
        companyId,
        meetingSessionId: Number(meeting.meeting_session_id),
    });

    const escalations = calls
        .flatMap((call) =>
            (call.escalations ?? []).map((escalation) => ({
                ...escalation,
                callId: Number(call.interview_call_id),
                reference: call.interview_reference,
                attemptNo: call.attempt_no,
            })),
        )
        .sort((left, right) => left.raisedTs.localeCompare(right.raisedTs));

    return { sessionReference: meeting.uuid, total: escalations.length, escalations };
};

export const getSessionAnswers = async (
    companyId: number,
    sessionReference: string,
): Promise<{
    sessionReference: string;
    callId: number;
    reference: string;
    answers: Record<string, ICallAnswerView[]>;
}> => {
    const meeting = await requireSessionMeeting(companyId, sessionReference);

    // The latest attempt: a session re-run opens a new call, and the sheet a
    // reviewer wants is the one that just happened.
    const call = await repository.findLatestCall({
        companyId,
        meetingSessionId: Number(meeting.meeting_session_id),
    });
    if (!call) throw new Error(`No interview call on session ${sessionReference}`);

    const grouped: Record<string, ICallAnswerView[]> = {};
    const runs = new Map<string, number>();
    let previous: string | null = null;
    const timeline = [...(await repository.readAnswers(call))].sort(
        (left, right) =>
            (left.recordedTs ?? left.askedTs ?? "").localeCompare(right.recordedTs ?? right.askedTs ?? "") ||
            (left.askedTs ?? "").localeCompare(right.askedTs ?? ""),
    );

    for (const entry of timeline) {
        const body = entry.question?.body?.trim() || entry.questionKey;
        if (body !== previous) runs.set(body, (runs.get(body) ?? 0) + 1);
        previous = body;
        const run = runs.get(body)!;

        (grouped[run === 1 ? body : `${body} (${run})`] ??= []).push({
            questionKey: entry.questionKey,
            questionPattern: entry.questionPattern ?? null,
            answer: {
                body: entry.answer?.body ?? "",
                rawResponse: entry.answer?.rawResponse ?? null,
            },
            outcome: entry.outcome ?? null,
            score: entry.score ?? null,
            askedTs: entry.askedTs ?? entry.recordedTs ?? null,
        });
    }

    return {
        sessionReference: meeting.uuid,
        callId: Number(call.interview_call_id),
        reference: call.interview_reference,
        answers: grouped,
    };
};

/** The persona's rating of the call, and nothing else from the sheet. */
export const getSessionEvaluation = async (
    sessionReference: string,
): Promise<{
    sessionId: number;
    sessionUid: string;
    callId: number;
    reference: string;
    submittedAt: string | null;
    averageScore: number | null;
    recommendation: string | null;
    summary: string | null;
    bands: { key: string; label: string; score: number | null; verdict: string | null; basis: string | null }[];
}> => {
    const meeting = await findSessionMeeting(sessionReference);
    if (!meeting) throw new Error(`No session ${sessionReference}`);

    const call = await repository.findLatestCall({
        companyId: Number(meeting.company_id),
        meetingSessionId: Number(meeting.meeting_session_id),
    });
    if (!call) throw new Error(`No interview call on session ${sessionReference}`);

    // Written by submit_interview alone, so a call that never submitted gives null bands, not a 404.
    const submitted = (await repository.readAnswers(call)).find((entry) => entry.questionKey === "submit_interview");
    const evaluation = (submitted?.captured?.evaluation ?? {}) as Record<string, unknown>;

    return {
        sessionId: Number(meeting.meeting_session_id),
        sessionUid: meeting.uuid,
        callId: Number(call.interview_call_id),
        reference: call.interview_reference,
        submittedAt: iso(call.submitted_ts),
        averageScore: call.average_score === null ? null : Number(call.average_score),
        recommendation: typeof evaluation.recommendation === "string" ? evaluation.recommendation : null,
        summary: typeof evaluation.summary === "string" ? evaluation.summary : null,
        bands: EVALUATION_BANDS.map((band) => {
            const rated = evaluation[band.key] as
                { score?: number | null; verdict?: string | null; basis?: string | null } | undefined;
            return {
                key: band.key,
                label: band.label,
                score: rated?.score ?? null,
                verdict: rated?.verdict ?? null,
                basis: rated?.basis ?? null,
            };
        }),
    };
};

/**
 * Where the recording landed, once something has put it there.
 *
 * Nothing in this service uploads to S3 yet - this is the hook whatever does
 * will call, so the bucket and key have one place to be written.
 */
export const attachRecording = async (
    companyId: number,
    interviewCallId: number,
    input: { recordingId: string; bucket?: string | null; key?: string | null; status?: string | null },
): Promise<IInterviewCallView> => {
    const call = await repository.findCallById(companyId, interviewCallId);
    if (!call) throw new Error(`No call ${interviewCallId} for company ${companyId}`);

    await repository.updateCall(call, {
        recordingId: input.recordingId,
        recordingBucket: input.bucket ?? null,
        recordingKey: input.key ?? null,
        recordingStatus: input.status ?? "stored",
    });

    return getCall(companyId, interviewCallId);
};
 
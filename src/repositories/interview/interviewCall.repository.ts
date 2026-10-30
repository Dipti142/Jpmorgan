import { Op, WhereOptions } from "sequelize";
import {
    ICallAnswerEntry,
    ICallAnswerHistoryRow,
    ICallEscalation,
    ICallParticipant,
    ICallTurnInput,
    IOpenCallInput,
    IRawTranscriptEvent,
    IUpdateCallInput,
    InterviewCallStatus,
} from "../../interfaces/IInterviewCall.interface";
import InterviewCall from "../../models/interviewCall.model";
import InterviewCallAnswer from "../../models/interviewCallAnswer.model";
import InterviewCallAnswerHistory from "../../models/interviewCallAnswerHistory.model";
import InterviewCallTurn from "../../models/interviewCallTurn.model";
import { trace, traceFailure } from "../../helpers/trace.helper";



/** Terminal outcomes. A call in one of these is history and is never resumed. */
const CLOSED: InterviewCallStatus[] = [
    "COMPLETED",
    "NO_ANSWER",
    "DECLINED",
    "FAILED_TO_JOIN",
    "INTERRUPTED",
    "ABANDONED",
    "CANCELLED",
    "FAILED",
];

/** The two people a call is opened for. Named now so a third is recognisable later. */
const expectedParticipants = (input: IOpenCallInput): ICallParticipant[] => {
    const roster: ICallParticipant[] = [];

    if (input.avatarDisplayName) {
        roster.push({ role: "persona", name: input.avatarDisplayName, source: "expected", turns: 0 });
    }
    if (input.candidateName) {
        roster.push({ role: "candidate", name: input.candidateName, source: "expected", turns: 0 });
    }

    return roster;
};

/**
 * Opens a call. attempt_no is read rather than counted from an in-memory list,
 * so two starts racing produce 1 and 2 rather than two 1s - the unique index
 * rejects the loser and the caller retries.
 */
export const openCall = async (input: IOpenCallInput): Promise<InterviewCall> => {
    const previous = await InterviewCall.findOne({
        where: {
            meeting_session_id: input.meetingSessionId,
            persona_program_id: input.personaProgramId,
        },
        order: [["attempt_no", "DESC"]],
        attributes: ["attempt_no"],
    });

    const created = await InterviewCall.create({
        company_id: input.companyId,
        meeting_session_id: input.meetingSessionId,
        persona_program_id: input.personaProgramId,
        interview_reference: input.interviewReference,
        attempt_no: (previous?.attempt_no ?? 0) + 1,
        job_short_code: input.jobShortCode ?? null,
        job_label: input.jobLabel ?? null,
        ats_system: input.atsSystem ?? null,
        ats_candidate_id: input.atsCandidateId ?? null,
        persona_key: input.personaKey ?? null,
        persona_role: input.personaRole ?? null,
        anam_avatar_id: input.anamAvatarId ?? null,
        avatar_key: input.avatarKey ?? null,
        avatar_display_name: input.avatarDisplayName ?? null,
        avatar_model: input.avatarModel ?? null,
        voice_id: input.voiceId ?? null,
        candidate_name: input.candidateName ?? null,
        candidate_email: input.candidateEmail ?? null,
        candidate_phone: input.candidatePhone ?? null,
        kb_folder: input.kbFolder ?? null,
        kb_domain: input.kbDomain ?? null,
        participants: expectedParticipants(input),
        channel: input.channel,
        script_hash: input.scriptHash ?? null,
        room_initiated_ts: input.roomInitiatedTs ?? null,
        questions_total: input.questionsTotal ?? null,
        questions_answered: 0,
        call_status: "IN_PROGRESS",
        initiated_ts: new Date(),
    });

    return created;
};

/**
 * Writes only the fields that were supplied, so refreshing a join state does
 * not blank the invite it was created with. Duration is derived here rather
 * than by a caller, because it is the one place that sees both ends.
 */
export const updateCall = async (
    call: InterviewCall,
    input: IUpdateCallInput,
): Promise<InterviewCall> => {
    const values: Record<string, unknown> = {};

    if (input.callStatus !== undefined) values.call_status = input.callStatus;
    if (input.failureCode !== undefined) values.failure_code = input.failureCode;
    if (input.failureReason !== undefined) values.failure_reason = input.failureReason;
    if (input.errorPayload !== undefined) values.error_payload = input.errorPayload;
    if (input.joinedTs !== undefined) values.joined_ts = input.joinedTs;
    if (input.answeredTs !== undefined) values.answered_ts = input.answeredTs;
    if (input.declinedTs !== undefined) values.declined_ts = input.declinedTs;
    if (input.submittedTs !== undefined) values.submitted_ts = input.submittedTs;
    if (input.endedTs !== undefined) values.ended_ts = input.endedTs;
    if (input.recordingId !== undefined) values.recording_id = input.recordingId;
    if (input.recordingStatus !== undefined) values.recording_status = input.recordingStatus;
    if (input.recordingBucket !== undefined) values.recording_bucket = input.recordingBucket;
    if (input.recordingKey !== undefined) values.recording_key = input.recordingKey;
    if (input.recordingExpiresTs !== undefined) values.recording_expires_ts = input.recordingExpiresTs;
    if (input.participants !== undefined) values.participants = input.participants;
    if (input.questionsTotal !== undefined) values.questions_total = input.questionsTotal;
    if (input.questionsAnswered !== undefined) values.questions_answered = input.questionsAnswered;
    if (input.averageScore !== undefined) values.average_score = input.averageScore;

    if (!Object.keys(values).length) return call;

    // Measured from the join, not the initiation: time spent in a lobby is not
    // time the candidate was on the call.
    const endedAt = (values.ended_ts as Date | null) ?? call.ended_ts;
    const startedAt = (values.joined_ts as Date | null) ?? call.joined_ts ?? call.initiated_ts;
    if (endedAt && startedAt) {
        values.duration_seconds = Math.max(0, Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000));
    }

    call.set(values);
    await call.save();

    return call;
};

/** Counted in place, so two lookups landing together cannot lose one. */
export const recordKnowledgeLookup = async (call: InterviewCall): Promise<void> => {
    await call.increment("kb_lookup_count", { by: 1 });
};

export const recordInterruption = async (call: InterviewCall): Promise<void> => {
    await call.increment("interrupted_count", { by: 1 });
};

/* -- reads --------------------------------------------------------------- */
export interface ICallSeries {
    companyId: number;
    meetingSessionId: number;
    personaProgramId?: number;
}

const seriesWhere = (series: ICallSeries): WhereOptions => ({
    company_id: series.companyId,
    meeting_session_id: series.meetingSessionId,
    ...(series.personaProgramId ? { persona_program_id: series.personaProgramId } : {}),
});

export const findOpenCall = async (series: ICallSeries): Promise<InterviewCall | null> =>
    InterviewCall.findOne({
        where: { ...seriesWhere(series), call_status: { [Op.notIn]: CLOSED } },
        order: [["attempt_no", "DESC"]],
    });
export const findLatestCall = async (series: ICallSeries): Promise<InterviewCall | null> =>
    InterviewCall.findOne({
        where: seriesWhere(series),
        order: [["attempt_no", "DESC"]],
    });

export const findCallsWithEscalations = async (series: ICallSeries): Promise<InterviewCall[]> =>
    InterviewCall.findAll({
        attributes: ["interview_call_id", "interview_reference", "attempt_no", "escalations"],
        where: seriesWhere(series),
        order: [["attempt_no", "ASC"]],
    });

export const findCallByReference = async (
    companyId: number,
    interviewReference: string,
): Promise<InterviewCall | null> =>
    InterviewCall.findOne({
        where: { company_id: companyId, interview_reference: interviewReference },
        order: [["attempt_no", "DESC"]],
    });


export const findCallById = async (
    companyId: number,
    interviewCallId: number,
): Promise<InterviewCall | null> =>
    InterviewCall.findOne({
        where: { company_id: companyId, interview_call_id: interviewCallId },
    });

export interface IListCallsInput {
    companyId: number;
    meetingSessionId?: number;
    interviewReference?: string;
    status?: InterviewCallStatus;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
}

/** The history listing, newest first, with a total so a console can page it. */
export const listCalls = async (
    input: IListCallsInput,
): Promise<{ rows: InterviewCall[]; total: number }> => {
    const where: WhereOptions = {
        company_id: input.companyId,
        ...(input.meetingSessionId ? { meeting_session_id: input.meetingSessionId } : {}),
        ...(input.interviewReference ? { interview_reference: input.interviewReference } : {}),
        ...(input.status ? { call_status: input.status } : {}),
    };

    if (input.from || input.to) {
        Object.assign(where, {
            initiated_ts: {
                ...(input.from ? { [Op.gte]: input.from } : {}),
                ...(input.to ? { [Op.lte]: input.to } : {}),
            },
        });
    }

    const { rows, count } = await InterviewCall.findAndCountAll({
        where,
        order: [["initiated_ts", "DESC"]],
        limit: input.limit,
        offset: input.offset,
    });

    return { rows, total: count };
};

/* -- the transcript ------------------------------------------------------- */

export const findTurns = async (interviewCallId: number): Promise<InterviewCallTurn[]> =>
    InterviewCallTurn.findAll({
        where: { interview_call_id: interviewCallId },
        order: [["turn_index", "ASC"]],
    });

/**
 * Replaces the whole transcript rather than appending.
 *
 * Anam's transcript is fetched as a complete session record and can be fetched
 * again as the call goes on, so appending would duplicate every earlier line.
 */
export const replaceTurns = async (
    interviewCallId: number,
    turns: ICallTurnInput[],
): Promise<number> => {
    await InterviewCallTurn.destroy({ where: { interview_call_id: interviewCallId } });

    if (!turns.length) return 0;

    await InterviewCallTurn.bulkCreate(
        turns.map((turn, index) => ({
            interview_call_id: interviewCallId,
            turn_index: index,
            speaker_role: turn.role,
            speaker_label: turn.speakerLabel ?? null,
            content: turn.content,
            language_code: turn.languageCode ?? null,
            language_name: turn.languageName ?? null,
            spoken_ts: turn.spokenTs ?? null,
            start_offset_ms: turn.startOffsetMs ?? null,
            end_offset_ms: turn.endOffsetMs ?? null,
            question_key: turn.questionKey ?? null,
        })),
    );

    return turns.length;
};

/* -- references ---------------------------------------------------------- */

/**
 * A spoken reference, so it has to be short enough to read out and unique enough
 * to look up. Retried against the table rather than derived from the id: the id
 * is not known until after the insert, and the persona reads this out.
 */
export const generateReference = async (companyId: number): Promise<string> => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const reference = `INT-${Math.floor(100_000 + Math.random() * 900_000)}`;
        const clash = await InterviewCall.findOne({
            where: { company_id: companyId, interview_reference: reference },
            attributes: ["interview_call_id"],
        });
        if (!clash) return reference;
    }
    throw new Error("Could not allocate an interview reference");
};

/* -- the answer sheet ---------------------------------------------------- */

/** The sheet for a call, created empty on first write rather than at the open. */
const answerSheetFor = async (call: InterviewCall): Promise<InterviewCallAnswer> => {
    const [sheet] = await InterviewCallAnswer.findOrCreate({
        where: { interview_call_id: call.interview_call_id },
        defaults: {
            interview_call_id: call.interview_call_id,
            company_id: call.company_id,
            answers: [],
        },
    });
    return sheet;
};

/** Empty rather than null when nothing has been recorded - callers count it. */
export const readAnswers = async (call: InterviewCall): Promise<ICallAnswerEntry[]> => {
    const sheet = await InterviewCallAnswer.findOne({
        where: { interview_call_id: call.interview_call_id },
    });
    return sheet?.answers ?? [];
};

export const PERSONA_JOINED = "persona_joined";

/** Writes one entry over the latest held for its key in the current join, or appends it below. */
export const upsertAnswer = async (
    call: InterviewCall,
    entry: ICallAnswerEntry,
    keepHeld: (held: ICallAnswerEntry) => boolean = () => false,
): Promise<ICallAnswerEntry[]> => {
    const sheet = await answerSheetFor(call);
    const answers = [...(sheet.answers ?? [])];
    const keys = answers.map((held) => held.questionKey);

    const at = keys.lastIndexOf(entry.questionKey);
    const joinedAt = keys.lastIndexOf(PERSONA_JOINED);
    const joinNo = keys.filter((key) => key === PERSONA_JOINED).length + (entry.questionKey === PERSONA_JOINED ? 1 : 0);
    const stamped = { ...entry, joinNo };

    if (at > joinedAt && !keepHeld(answers[at])) answers[at] = stamped;
    else answers.push(stamped);

    // Reassigned, not mutated in place: sequelize compares by reference to
    // decide a JSONB column is dirty, so an in-place push would never save.
    sheet.set("answers", answers);
    await sheet.save();
    return answers;
};

export const saveRawTranscript = async (
    call: InterviewCall,
    attemptId: string,
    events: IRawTranscriptEvent[],
): Promise<void> => {
    const sheet = await answerSheetFor(call);
    const earlier = (sheet.raw_transcript ?? []).filter((event) => event.attemptId !== attemptId);
    const timeline = [...earlier, ...events.map((event) => ({ ...event, attemptId }))].sort((left, right) =>
        left.at.localeCompare(right.at),
    );
    sheet.set("raw_transcript", timeline);
    await sheet.save();
};

/* -- the answer history -------------------------------------------------- */

/**
 * Appends one tool call to tl_interview_call_answer_history.
 *
 * Never throws: this is an audit trail, and losing the call because the trail
 * could not be written would be the wrong trade mid-interview.
 */
export const appendAnswerHistory = async (
    call: InterviewCall,
    row: ICallAnswerHistoryRow,
): Promise<void> => {
    try {
        const saved = await InterviewCallAnswerHistory.create({
            interview_call_id: call.interview_call_id,
            company_id: call.company_id,
            question_key: row.questionKey,
            question_pattern: row.questionPattern ?? null,
            question_text: row.questionText ?? null,
            expected_answer: row.expectedAnswer ?? null,
            tool: row.tool,
            outcome: row.outcome ?? null,
            answer: row.answer ?? null,
            raw_response: row.rawResponse ?? null,
            captured: row.captured ?? {},
            score: row.score ?? null,
            asked_ts: row.askedTs ? new Date(row.askedTs) : null,
            tool_called_ts: new Date(),
            seconds_since_asked: row.secondsSinceAsked ?? null,
        });

        trace("history", call.interview_reference, "saved", {
            id: Number(saved.answer_history_id),
            tool: row.tool,
            question: row.questionKey,
            pattern: row.questionPattern ?? "-",
            outcome: row.outcome ?? "-",
            seconds: row.secondsSinceAsked,
        });
    } catch (error) {
        traceFailure("history", call.interview_reference, `save ${row.tool} ${row.questionKey}`, error);
    }
};

/** How many times this question has been put since the persona last joined. The silence counter. */
export const countAsks = async (call: InterviewCall, questionKey: string): Promise<number> => {
    const joinedTs = await InterviewCallAnswerHistory.max<Date | null, InterviewCallAnswerHistory>("tool_called_ts", {
        where: { interview_call_id: call.interview_call_id, tool: PERSONA_JOINED },
    });

    return InterviewCallAnswerHistory.count({
        where: {
            interview_call_id: call.interview_call_id,
            question_key: questionKey,
            tool: "ask_question",
            ...(joinedTs ? { tool_called_ts: { [Op.gt]: joinedTs } } : {}),
        },
    });
};

/** Keeps a replayed raw-transcript post from logging the same event twice, and counts how one question has gone. */
export const countToolCalls = async (
    call: InterviewCall,
    tool: string,
    narrow: { questionKey?: string; outcome?: string } = {},
): Promise<number> =>
    InterviewCallAnswerHistory.count({
        where: {
            interview_call_id: call.interview_call_id,
            tool,
            ...(narrow.questionKey ? { question_key: narrow.questionKey } : {}),
            ...(narrow.outcome ? { outcome: narrow.outcome } : {}),
        },
    });

export const countSectionIntros = async (call: InterviewCall, pattern: string): Promise<number> =>
    InterviewCallAnswerHistory.count({
        where: {
            interview_call_id: call.interview_call_id,
            question_pattern: pattern,
            tool: "section_intro",
        },
    });

/* -- escalations --------------------------------------------------------- */

/** Appended to the call. Same reference rule as the answer sheet applies. */
export const appendEscalation = async (
    call: InterviewCall,
    escalation: ICallEscalation,
): Promise<ICallEscalation[]> => {
    const escalations = [...(call.escalations ?? []), escalation];
    call.set("escalations", escalations);
    await call.save();
    return escalations;
};

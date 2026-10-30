import { InterviewAnswerOutcome, IInterviewChecklistView } from "../../interfaces/IInterview.interface";
import { suggestOwner } from "../escalation.service";
import { resolvePersona } from "../persona.service";
import { renderTokens } from "../prompt.service";
import { ScriptBuilderService } from "../scriptBuilder.service";
import { IScriptQuestion, IScriptSet, ScriptMode } from "../../interfaces/IScript.interface";
import { maskEmail, maskPhone, normaliseHeardEmail, normaliseHeardPhone, spokenEmail, toSpokenText } from "../../helpers/speech.helper";
import InterviewCall from "../../models/interviewCall.model";
import { trace } from "../../helpers/trace.helper";
import * as calls from "./interviewCall.service";
import * as vaRepo from "../../repositories/meeting/vaSchedule.repository";
import { PERSONA_JOINED } from "../../repositories/interview/interviewCall.repository";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import * as applications from "../meeting/applicationDetails.service";
import { emitAgendaFocus, emitAgendaUpdated, emitSessionEnded } from "../../sockets/virtualAvatar.socket";
import { ICallAnswerEntry, ICallAnswerHistoryRow } from "../../interfaces/IInterviewCall.interface";
import { CONVERSATION_HANDLING, ESCALATION_RESPONSES } from "../../constants/interview/interview.script";
import { EVALUATION_BANDS, HIRE_RECOMMENDATIONS } from "../../constants/interview/interview.tools";
import { DIRECTION, HANDOVER_GUIDANCE, RECORD_HEADING, RECORD_WITH, SECTION_INTRO, VERBATIM_PATTERNS } from "../../constants/script.text";
import { DefaultScriptPattern } from "../../interfaces/IProgram.interface";

/* -- the call outline ---------------------------------------------------- */

// jobId is still accepted so the API does not change; jobShortCode is what selects a script.
export const getProgramOutline = async (
    companyId: number,
    _jobId?: number | null,
    jobShortCode?: string | null,
    meetingSessionId?: number | null,
): Promise<{
    checklists: IInterviewChecklistView[];
    mode: ScriptMode;
    scriptTemplateId?: number | null;
    meetingStatus?: string | null;
}> => {
    const booking = meetingSessionId ? await vaRepo.findByMeeting(meetingSessionId) : null;
    const { sets, mode } = await ScriptBuilderService.resolve({
        companyId,
        programKind: "INTERVIEW",
        jobShortCode: jobShortCode ?? booking?.job_short_code,
        scriptTemplateId: booking?.custom_script_template_id,
        isOngoing: booking?.meeting_status === "ONGOING",
    });

    return {
        mode,
        ...(meetingSessionId
            ? { scriptTemplateId: booking?.custom_script_template_id ?? null, meetingStatus: booking?.meeting_status ?? null }
            : {}),
        checklists: sets.map((set) => ({
            key: set.key,
            title: set.title,
            kind: set.pattern,
            order: set.order,
            ratingRequired: set.ratingRequired,
            jobId: null,
            jobLabel: null,
            questions: set.questions.map((question) => ({
                key: question.key,
                title: question.title,
                kind: question.kind,
                required: question.required,
                order: question.order,
                captureFields: question.captureFields,
                ratingRequired: question.ratingRequired,
                answer: null,
            })),
        })),
    };
};

/* -- the script the persona is given ------------------------------------ */

export const CLOSING_BLOCKS: string[] = [
    CONVERSATION_HANDLING,
    // recorded and pressed arrive from the tool with the real owner on them, so the
    // only one stated here is the one no tool ever hands over.
    `IF YOU CANNOT ANSWER SOMETHING\n- ${ESCALATION_RESPONSES.outOfScope}`,
    [
        "WHEN THE INTERVIEW IS OVER",
        "- The recording tool hands you the close the moment the last question goes down, with the record of " +
        "their answers and how to rate them. Say the close then and deal with whatever they ask. Once they have " +
        "nothing further, call submit_interview; its reply tells you to say goodbye, and the call ends once you " +
        "have said it. Never leave the goodbye out.",
        "- Never say the reference out loud. Do not ask to end the call, do not offer more help, and do not " +
        "start a new topic.",
    ].join("\n"),
];

const RATING_GUIDE = [
    "RATING THEM WHEN YOU SUBMIT",
    "The five bands submit_interview asks you to rate, each judged across the whole call and not on one answer:",
    ...EVALUATION_BANDS.map((band) => `- ${band.key} - ${band.label}: ${band.bar}.`),
    "Scale: 1 well below the bar, 2 below, 3 partially meets, 4 meets, 5 exceeds.",
    `Then recommend one of ${HIRE_RECOMMENDATIONS.join(", ")}, following from those ratings and the call as a ` +
    "whole: strong hire where they were clearly above the bar throughout, hire where they met it with nothing " +
    "serious against them, weak hire where they could do the work but with real gaps, no hire where they fell " +
    "short on something the role cannot do without. It must agree with the ratings and the summary - a strong " +
    "hire beside mostly threes reads as a mistake.",
    "Every band needs a basis of three or four sentences that justifies that exact figure, in this order: what " +
    "they did well, quoting or closely paraphrasing something they actually said; what was missing, weak or " +
    "wrong, again with an example from the call; and why that lands on this number and not one higher or one " +
    "lower. A 3 must name what held it back from a 4. A basis that only praises is wrong for anything under 5, " +
    "and one that only criticises is wrong for anything over 1. Generic lines such as 'followed the flow " +
    "appropriately' or 'answered appropriately' are not a basis.",
    "The evaluation summary is three or four sentences of your own judgement of how they did overall, naming " +
    "what carried each rating and where they were weakest - not a recap of what was asked.",
    "Where the evidence is thin, send the figure the call best supports - a missing band is worse than an " +
    "imperfect one. All of it is advice for the person who decides and did not hear the call; the decision is " +
    "theirs. None of it is ever said aloud, and you do not tell them they are being rated.",
].join("\n");

// No placeholders passed in: a console preview leaves [agent_name] etc. standing,
// same as ScriptBuilderService.resolve() does for a template view.
export const getProgramScript = async (
    companyId: number,
    jobShortCode?: string | null,
    meetingSessionId?: number | null,
): Promise<{
    script: string;
    mode: ScriptMode;
    scriptTemplateId?: number | null;
    meetingStatus?: string | null;
}> => {
    const booking = meetingSessionId ? await vaRepo.findByMeeting(meetingSessionId) : null;
    const built = await ScriptBuilderService.build({
        companyId,
        programKind: "INTERVIEW",
        jobShortCode: jobShortCode ?? booking?.job_short_code,
        scriptTemplateId: booking?.custom_script_template_id,
        isOngoing: booking?.meeting_status === "ONGOING",
        closing: CLOSING_BLOCKS,
    });

    return {
        script: built.script,
        mode: built.mode,
        ...(meetingSessionId
            ? { scriptTemplateId: booking?.custom_script_template_id ?? null, meetingStatus: booking?.meeting_status ?? null }
            : {}),
    };
};

/* -- closing the room's interview ---------------------------------------- */

export const endCallForMeeting = async (companyId: number, meetingSessionId: number): Promise<void> => {
    const call = await calls.findOpenCall({ companyId, meetingSessionId });
    if (!call) return;

    await calls.closeCall(call, "ABANDONED", { failureCode: "ROOM_ENDED", failureReason: "Room ended" });
};

/* -- what every tool call resolves against ------------------------------- */

const context = async (companyId: number, interviewReference: string) => {
    const call = await calls.findCallByReference(companyId, String(interviewReference ?? "").trim());
    if (!call) throw new Error(`No interview ${interviewReference} for this company`);

    const { program, company } = await resolvePersona(companyId, undefined, "INTERVIEW");
    const booking = await vaRepo.findByMeeting(Number(call.meeting_session_id));
    const { questions, sets, mode } = await ScriptBuilderService.resolve({
        companyId,
        programKind: "INTERVIEW",
        jobShortCode: call.job_short_code,
        scriptTemplateId: booking?.custom_script_template_id,
        isOngoing: booking?.meeting_status === "ONGOING",
        placeholders: ScriptBuilderService.placeholders({
            agentName: call.avatar_display_name,
            companyName: company.company_name,
            candidateName: call.candidate_name,
        }),
    });
    const askable = sets.filter((set) => !VERBATIM_PATTERNS.includes(set.pattern)).flatMap((set) => set.questions);
    return { call, program, company, questions, askable, sets, mode };
};

/** Which set a question came out of - for the pattern recorded on the answer sheet. */
const patternOf = (sets: IScriptSet[], questionKey: string): DefaultScriptPattern | null =>
    sets.find((set) => set.questions.some((question) => question.key === questionKey))?.pattern ?? null;

const conclusionOf = (sets: IScriptSet[]): IScriptQuestion | undefined =>
    sets.find((set) => set.pattern === "INTERVIEW_CONCLUSION")?.questions[0];

const meetingUuidOf = async (call: InterviewCall): Promise<string | null> =>
    (await meetingRepo.findById(Number(call.meeting_session_id)))?.uuid ?? null;

export const recordedView = (entry: ICallAnswerEntry) => {
    const held = entry.captured?.outcome ?? (entry.captured?.matches === true ? "yes" : undefined);
    const choice: "yes" | "no" | null = held === "yes" || held === "no" ? held : entry.outcome === "answered" ? null : "no";
    return { choice, answer: entry.answer?.body || null, score: entry.score ?? null };
};

const SECTION_INTRO_TOOL = "section_intro";
const NEXT_QUESTION_TOOL = "next_question";

const sectionIntroFor = async (call: InterviewCall, pattern: DefaultScriptPattern | null): Promise<string | null> => {
    const intro = pattern ? SECTION_INTRO[pattern] : undefined;
    if (!intro || !pattern) return null;

    const alreadySaid = (await calls.countSectionIntros(call, pattern)) > 0;
    return alreadySaid ? null : intro;
};

const nextUnanswered = (
    questions: IScriptQuestion[],
    answered: Set<string>,
    afterKey: string,
): IScriptQuestion | undefined =>
    questions.slice(questions.findIndex((candidate) => candidate.key === afterKey) + 1)
        .find((candidate) => !answered.has(candidate.key));

/** The entry exists from the moment ask_question puts it, with nothing in it yet. */
const OUTCOME_ASKED = "asked";
const LIFECYCLE_TYPE = "LIFECYCLE";

/** A question the candidate asked, not one from the script. Never rated. */
export const FAQ_TYPE = "FAQ";
const isQuestionEntry = (entry: ICallAnswerEntry): boolean =>
    entry.type !== LIFECYCLE_TYPE && entry.type !== FAQ_TYPE;

const answeredKeys = (answers: ICallAnswerEntry[]): Set<string> =>
    new Set(
        answers
            .filter((entry) => isQuestionEntry(entry) && entry.outcome !== OUTCOME_ASKED)
            .map((entry) => entry.questionKey),
    );

export const latestAnswers = (answers: ICallAnswerEntry[]): Map<string, ICallAnswerEntry> =>
    new Map(
        answers
            .filter((entry) => isQuestionEntry(entry) && entry.outcome !== OUTCOME_ASKED)
            .map((entry) => [entry.questionKey, entry]),
    );

/** The required questions nothing is recorded against yet - the one rule the close is read from. */
const uncovered = (questions: IScriptQuestion[], answers: ICallAnswerEntry[]): IScriptQuestion[] => {
    const answered = answeredKeys(answers);
    return questions.filter((candidate) => candidate.required !== false && !answered.has(candidate.key));
};

export const recordLifecycle = async (
    call: InterviewCall,
    input: { tool: string; outcome: string; detail?: string; captured?: Record<string, unknown>; at?: Date },
): Promise<void> => {
    const at = (input.at ?? new Date()).toISOString();

    await calls.upsertAnswer(call, {
        questionKey: input.tool,
        type: LIFECYCLE_TYPE,
        question: { body: input.tool },
        questionText: null,
        questionPattern: null,
        expectedAnswer: null,
        answer: { body: input.detail ?? "", rawResponse: null },
        ...(input.captured ? { captured: input.captured } : {}),
        outcome: input.outcome,
        recordedTs: at,
        answerSeconds: null,
    });

    await calls.appendAnswerHistory(call, {
        questionKey: input.tool,
        questionPattern: null,
        questionText: null,
        expectedAnswer: null,
        tool: input.tool,
        outcome: input.outcome,
        answer: input.detail ?? "",
        rawResponse: null,
        captured: input.captured ?? {},
        score: null,
        askedTs: null,
        secondsSinceAsked: null,
    });
};
const secondsSince = (askedTs?: string): number | null => {
    const asked = askedTs ? Date.parse(askedTs) : Number.NaN;
    return Number.isFinite(asked) ? Math.max(0, Math.round((Date.now() - asked) / 1000)) : null;
};
const answerEntry = (
    question: IScriptQuestion,
    input: {
        tool: string;
        type: string;
        answer: string;
        /** Their words, unsummarised. Blank where nothing was said yet. */
        rawResponse?: string;
        captured?: Record<string, unknown>;
        score?: number | null;
        outcome?: string;
        pattern?: string | null;
        /** Carried over from the ask_question entry this one replaces. */
        askedTs?: string;
    },
): ICallAnswerEntry => {
    const at = new Date().toISOString();
    const outcome = input.outcome ?? "answered";
    const captured = input.captured && Object.keys(input.captured).length ? input.captured : undefined;
    const seconds = secondsSince(input.askedTs);

    return {
        questionKey: question.key,
        type: input.type,
        // Copied rather than referenced: a later edit to the script must not change
        // what the record says was asked, expected, or answered.
        question: { body: question.title },
        questionText: question.question,
        questionPattern: input.pattern ?? null,
        expectedAnswer: question.expectedAnswer ?? null,
        answer: { body: input.answer, rawResponse: input.rawResponse?.trim() || null },
        ...(captured ? { captured } : {}),
        ...(input.score == null ? {} : { score: input.score }),
        outcome,
        ...(input.askedTs ? { askedTs: input.askedTs } : {}),
        recordedTs: at,
        answerSeconds: seconds,
    };
};

const keepsEarlierAnswer = (entry: ICallAnswerEntry) => (held: ICallAnswerEntry): boolean =>
    held.outcome !== OUTCOME_ASKED &&
    (held.answer?.rawResponse || held.answer?.body) !== (entry.answer?.rawResponse || entry.answer?.body);

/** The history row for one tool call, built off the same question and inputs. */
const historyRow = (
    question: IScriptQuestion,
    input: {
        tool: string;
        answer: string;
        rawResponse?: string;
        captured?: Record<string, unknown>;
        score?: number | null;
        outcome?: string;
        pattern?: string | null;
        askedTs?: string;
    },
): ICallAnswerHistoryRow => ({
    questionKey: question.key,
    questionPattern: input.pattern ?? null,
    questionText: question.question,
    expectedAnswer: question.expectedAnswer ?? null,
    tool: input.tool,
    outcome: input.outcome ?? "answered",
    answer: input.answer,
    rawResponse: input.rawResponse?.trim() || null,
    captured: input.captured ?? {},
    score: input.score ?? null,
    askedTs: input.askedTs ?? null,
    secondsSinceAsked: secondsSince(input.askedTs),
});

const sinceJoined = (answers: ICallAnswerEntry[]): ICallAnswerEntry[] =>
    answers.slice(answers.map((entry) => entry.questionKey).lastIndexOf(PERSONA_JOINED) + 1);

/** When the question was put since the persona last joined, so recording it can say how long they took. */
const askedTsFor = (answers: ICallAnswerEntry[], questionKey: string): string | undefined =>
    sinceJoined(answers).find((entry) => entry.questionKey === questionKey)?.askedTs;

const putQuestion = async (
    call: InterviewCall,
    question: IScriptQuestion,
    input: { pattern: DefaultScriptPattern | null; tool: string; askedTs?: string; withIntro: boolean },
): Promise<{ line: string; brief: string }> => {
    await calls.upsertAnswer(call, {
        questionKey: question.key,
        type: "QA",
        question: { body: question.title },
        questionText: question.question,
        questionPattern: input.pattern,
        expectedAnswer: question.expectedAnswer ?? null,
        answer: { body: "", rawResponse: null },
        outcome: OUTCOME_ASKED,
        askedTs: input.askedTs ?? new Date().toISOString(),
    });

    await calls.appendAnswerHistory(
        call,
        historyRow(question, { tool: input.tool, answer: "", outcome: OUTCOME_ASKED, pattern: input.pattern }),
    );

    const uuid = await meetingUuidOf(call);
    if (uuid) emitAgendaFocus(uuid, { questionKey: question.key });

    const brief = [
        HANDOVER_GUIDANCE,
        ...ScriptBuilderService.brief(question).map((line) => `- ${line}`),
        `- ${RECORD_WITH(input.pattern === "CHECKLIST" ? "record_checklist" : "record_answer", question.key)}`,
    ].join("\n");
    const spoken = toSpokenText(question.question);

    const sectionIntro = input.withIntro ? await sectionIntroFor(call, input.pattern) : null;
    if (!sectionIntro) return { line: spoken, brief };

    await calls.appendAnswerHistory(
        call,
        historyRow(question, { tool: SECTION_INTRO_TOOL, answer: sectionIntro, outcome: OUTCOME_ASKED, pattern: input.pattern }),
    );
    return { line: `${toSpokenText(sectionIntro)}\n\n${spoken}`, brief };
};

/**
 * How many times one question may go unanswered before the call is given up.
 * Three is "ask, ask again, ask once more" - past that nobody is there.
 */
const MAX_UNANSWERED_ASKS = 3;

const WAIT_DIRECTION =
    `Say this, exactly as written, and then stop and wait. If you hear nothing at all, call ask_question ` +
    `again for this same question.`;

const CLOSING_INVITE_TOOL = "closing_invite";

/** The close, said once. Authored wording wins - a custom script need not carry a closing question at all. */
const CLOSING_INVITE =
    `Thank you, that is everything I needed to ask. If you have any questions for me, now would be the time.`;

const GOODBYE_THEN_SUBMIT =
    `Once they have nothing further, call submit_interview with all five ratings and your recommendation - you ` +
    `may tell them in a few words that that is everything from your side first. It is the only thing that ` +
    `closes the interview. Its reply tells you to say your goodbye; the call ends once you have said it.`;

const GOODBYE_AFTER_SUBMIT =
    `Submitted - never say this aloud. Now say your goodbye, in your own words and two sentences at most: thank ` +
    `them for their time, tell them the team will be in touch within two working days, and say goodbye. Never ` +
    `mention the reference, the ratings or the recommendation. This is the last thing you say.`;

// Line first, direction second - the same shape ask_question has handed over all
// call, so there is no doubt which half is spoken. WAIT_DIRECTION cannot be reused:
// its tail says to ask again on silence, and silence here means submit.
const closingHandover = (line: string) =>
    `${line}\n\nSay that, exactly as written, and then stop and wait. Nothing after this line is spoken. ` +
    `Everything is covered, so this is the close: if they ask you something, answer it the way you were told, ` +
    `then ask whether there is anything else. ${GOODBYE_THEN_SUBMIT}`;

const CLOSED_DIRECTION =
    `You have already said the closing and invited their questions. Do not say it again. ${GOODBYE_THEN_SUBMIT}`;

const closingRecord = async (call: InterviewCall, askable: IScriptQuestion[]): Promise<string> => {
    const answers = await calls.readAnswers(call);
    const held = latestAnswers(answers);
    const asked = answers.filter((entry) => entry.type === FAQ_TYPE);
    const found = asked.filter((entry) => entry.captured?.found === true).length;

    return [
        RECORD_HEADING,
        ...askable.map((question) => {
            const entry = held.get(question.key);
            if (!entry) return `- ${question.title}: nothing recorded`;
            const score = typeof entry.score === "number" ? `, scored ${entry.score}` : "";
            return `- ${question.title} (${entry.outcome ?? "answered"}${score}): ${entry.answer?.body || "no summary"}`;
        }),
        ...(asked.length ? [`- They asked ${asked.length} question(s) of their own, ${found} answered from what you looked up. These carry no rating.`] : []),
        "",
        RATING_GUIDE,
    ].join("\n");
};

/**
 * Every path that can cover the last question ends here, so the close is handed
 * over the moment it is reached rather than left for the model to improvise.
 */
const closingDirection = async (call: InterviewCall, sets: IScriptSet[], askable: IScriptQuestion[]): Promise<string> => {
    const record = await closingRecord(call, askable);
    if ((await calls.countToolCalls(call, CLOSING_INVITE_TOOL)) > 0) return `${CLOSED_DIRECTION}\n\n${record}`;

    const closing = conclusionOf(sets);
    const line = closing?.question?.trim() ? toSpokenText(closing.question) : CLOSING_INVITE;

    await calls.appendAnswerHistory(call, {
        questionKey: closing?.key ?? CLOSING_INVITE_TOOL,
        tool: CLOSING_INVITE_TOOL,
        outcome: OUTCOME_ASKED,
        answer: line,
        captured: {},
    });

    const handling = closing?.context?.trim() ? `\n\n${DIRECTION(closing.context)}` : "";
    return `${closingHandover(line)}${handling}\n\n${record}`;
};

// An authored outcome often says to stay on the item - spell the address out, read
// the number back - so advancing is not always the next thing to do.
const nextQuestionDirection = (left: number, authored?: string) =>
    `Recorded - never say any of this aloud, and never read back what you recorded. ${left} still to cover. ` +
    `Respond in your own words to something specific they just said - not a stock phrase - then ` +
    (authored ?? `call ask_question for the next one and ask only that one.`) +
    ` Whenever you move on, do it in this same turn: call ask_question straight after the acknowledgement and ` +
    `never end your turn on it.`;

const handOverDirection = (handover: { line: string; brief: string }, left: number, authored?: string) =>
    `${handover.line}\n\nRecorded - never read back what you recorded. ${left} still to cover, and the question ` +
    `above is the next one, already put for you: do not call ask_question for it. In one turn, respond in your ` +
    `own words to something specific they just said - not a stock phrase - and go straight on to the question ` +
    `above - never end your turn on the acknowledgement alone. ${WAIT_DIRECTION}` +
    (authored ? ` On this answer: ${authored}` : "") +
    `\n\n${handover.brief}`;

const giveUpDirection = (attempt: number) =>
    `You have put this question ${attempt} times and heard nothing back. Stop asking. Say briefly that you ` +
    `cannot hear them and that the team will be in touch to rearrange, then call end_call. Do not call ` +
    `submit_interview - the interview is not finished, it is being abandoned. Say nothing else.`;

// A second ask on a question already put never gets the wording back: handing it
// over again is what put the same question to them three times.
const askWhyDirection = (questionKey: string, pattern: DefaultScriptPattern | null) =>
    `You have already put this question to them and nothing is recorded against it. Do not say it again. ` +
    `Ask them in one short question why they would rather skip it, then stop and wait. Record what they ` +
    `give you under question key "${questionKey}" with ` +
    (pattern === "CHECKLIST"
        ? `record_checklist, outcome "no", their reason as the summary and their words as rawResponse.`
        : `record_answer, outcome "skipped", their reason as the summary and their words as rawResponse.`);

export const askQuestion = async (input: {
    companyId: number;
    interviewReference: string;
    questionKey?: string;
}) => {
    const { call, askable, sets } = await context(input.companyId, input.interviewReference);
    const answers = await calls.readAnswers(call);
    const answered = answeredKeys(answers);
    const left = uncovered(askable, answers);

    // A model that calls this with no key, or a key it made up, still gets the right
    // question back rather than an error it will talk over - it has no outline to
    // find the right key in. Nothing left means the close.
    const named = input.questionKey ? askable.find((candidate) => candidate.key === input.questionKey) : undefined;
    if (input.questionKey && !named) trace("tool", input.interviewReference, "ask_unknown_key", { question: input.questionKey });
    const requested = named ?? left[0];

    if (!requested) {
        return {
            asked: false, alreadyAnswered: true, leave: false, attempt: 0,
            questionKey: null, pattern: null,
            say: await closingDirection(call, sets, askable),
        };
    }

    const advanced = answered.has(requested.key);
    // nextUnanswered only looks forward, so one still open earlier in the list
    // would read as an interview already over - and submit would then refuse it.
    const question = advanced ? nextUnanswered(askable, answered, requested.key) ?? left[0] : requested;

    if (!question) {
        return {
            asked: false, alreadyAnswered: true, leave: false, attempt: 0,
            questionKey: requested.key, pattern: patternOf(sets, requested.key),
            say: await closingDirection(call, sets, askable),
        };
    }

    const pattern = patternOf(sets, question.key);

    // Counted before this attempt is written, so the third silence is the third.
    const attempt = (await calls.countAsks(call, question.key)) + 1;
    const leave = attempt > MAX_UNANSWERED_ASKS;

    // Re-asking within a join keeps the first timestamp; after a rejoin the clock restarts.
    const handover = await putQuestion(call, question, {
        pattern,
        tool: "ask_question",
        askedTs: askedTsFor(answers, question.key),
        withIntro: !leave,
    });

    return {
        asked: true, alreadyAnswered: false, leave, attempt,
        questionKey: question.key, pattern,
        say: leave
            ? giveUpDirection(attempt - 1)
            : attempt > 1
                ? askWhyDirection(question.key, pattern)
                : `${handover.line}\n\n${WAIT_DIRECTION}\n\n${handover.brief}`,
    };
};

const afterRecording = async (
    call: InterviewCall,
    script: { sets: IScriptSet[]; askable: IScriptQuestion[] },
    question: IScriptQuestion,
    recorded: { entry: ICallAnswerEntry; answers: ICallAnswerEntry[] },
    direction: { authored?: string; advance: boolean },
) => {
    const answered = answeredKeys(recorded.answers);
    const remaining = uncovered(script.askable, recorded.answers);

    // Kept current rather than written at the close, so a call that is cut short
    // still says how far it got.
    await calls.updateCall(call, {
        questionsAnswered: answered.size,
        // The first thing recorded is the first thing they actually said - there
        // is no earlier signal that a person is on the other end.
        ...(call.answered_ts ? {} : { answeredTs: new Date() }),
    });

    const uuid = await meetingUuidOf(call);
    if (uuid) emitAgendaUpdated(uuid, { key: question.key, kind: question.kind, recorded: recordedView(recorded.entry) });

    const following = !remaining.length || !direction.advance
        ? undefined
        : nextUnanswered(script.askable, answered, question.key) ?? remaining[0];
    const next = recorded.answers.some((held) => held.questionKey === following?.key) ? undefined : following;

    // Direction, not a line: the old wording listed the remaining questions, and
    // a persona handed a list of questions reads the list out.
    const say = !remaining.length
        ? await closingDirection(call, script.sets, script.askable)
        : next
            ? handOverDirection(
                await putQuestion(call, next, {
                    pattern: patternOf(script.sets, next.key),
                    tool: NEXT_QUESTION_TOOL,
                    withIntro: true,
                }),
                remaining.length,
                direction.authored,
            )
            : nextQuestionDirection(remaining.length, direction.authored);

    return { next, remaining, say };
};

/** Requirement: verify the contact details, and store what they actually said. */
export const verifyContact = async (input: {
    companyId: number;
    interviewReference: string;
    questionKey?: string;
    field: "email" | "phone";
    statedValue: string;
}) => {
    const { call, questions, askable, sets } = await context(input.companyId, input.interviewReference);

    // The key it was asked under comes first: an authored question carries the
    // tool of its pattern, so nothing in a custom script ever declares this one.
    const question =
        questions.find((candidate) => candidate.key === input.questionKey) ??
        ScriptBuilderService.findByTool(questions, "verify_contact", { field: input.field }) ??
        questions.find((candidate) => candidate.key === `verify-${input.field}`);
    const responses: Record<string, string> = question?.responses ?? {};

    if (!question) trace("tool", input.interviewReference, "verify_without_question", { field: input.field });

    // Recorded like any other exchange, so the sheet reads as the call ran rather than
    // hiding the first two topics in a side column. entryOutcome can leave it open.
    const recordVerification = async (spoken: string, outcome: string, entryOutcome = outcome) => {
        if (!question) return undefined;

        const written = {
            tool: "verify_contact",
            answer: spoken, rawResponse: input.statedValue,
            captured: { field: input.field, statedValue: spoken, matches: outcome === "match" },
            outcome,
            pattern: patternOf(sets, question.key),
            askedTs: askedTsFor(await calls.readAnswers(call), question.key),
        };

        const entry = answerEntry(question, { ...written, type: "VERIFICATION", outcome: entryOutcome });
        const answers = await calls.upsertAnswer(call, entry, keepsEarlierAnswer(entry));
        await calls.appendAnswerHistory(call, historyRow(question, written));
        return { entry, answers };
    };

    // This IS the recording for its question, so record_answer never runs on this
    // path - and a contact check can be the last thing a script asks for.
    const settle = async (spoken: string, outcome: string, authored: string) => {
        const recorded = await recordVerification(spoken, outcome);
        if (!question || !recorded) return authored;

        const after = await afterRecording(call, { sets, askable }, question, recorded, { authored, advance: true });
        return after.remaining.length ? after.say : `${authored}\n\n${after.say}`;
    };

    // The call's own snapshot, taken when it opened - there is no vendor to re-read.
    const onFile = input.field === "email" ? call.candidate_email : call.candidate_phone;
    const stated =
        input.field === "email"
            ? normaliseHeardEmail(input.statedValue)
            : normaliseHeardPhone(input.statedValue);

    if (!stated) {
        return { question: question?.key, outcome: "notHeard", say: responses.notHeard ?? "Ask them to say it again, slower." };
    }

    const normalisedOnFile =
        input.field === "email" ? normaliseHeardEmail(onFile ?? "") : normaliseHeardPhone(onFile ?? "");

    if (!normalisedOnFile) {
        return {
            question: question?.key,
            outcome: "missing",
            say: await settle(stated, "missing", responses.missing ?? "Confirm you have taken it down."),
        };
    }

    if (normalisedOnFile === stated) {
        return {
            question: question?.key,
            outcome: "match",
            say: await settle(stated, "match", responses.match ?? "That matches. Confirm it back once and move on."),
        };
    }

    // Masked, and spoken as words - the only form of the on-file value it may say out loud.
    const onFileMasked = input.field === "email" ? spokenEmail(maskEmail(onFile)) : maskPhone(onFile);
    const mismatchSay = renderTokens(responses.mismatch ?? "That does not match {{onFileMasked}}. Ask once more.", {
        onFileMasked,
    });

    const mismatches = question
        ? await calls.countToolCalls(call, "verify_contact", { questionKey: question.key, outcome: "mismatch" })
        : 0;

    // One correction, not an argument: the first mismatch leaves the question open to
    // be put again, so nothing is filled and nothing counts as covered until it is.
    if (question && mismatches === 0) {
        await recordVerification(stated, "mismatch", OUTCOME_ASKED);

        return {
            question: question.key,
            outcome: "mismatch",
            say:
                `${mismatchSay} Ask them for it once more, ${input.field === "email" ? "letter by letter" : "digit by digit"}, ` +
                `then stop and wait - do not call ask_question for it. Verify what they give you with verify_contact ` +
                `under question key "${question.key}". This question is not covered until they have.`,
        };
    }

    // Checked against the record again, not waved through: a second answer that
    // matches never reaches here. What they said is taken down as theirs, and the
    // discrepancy goes to a person, because nothing on this call can tell which of
    // the two is out of date.
    const discrepancy = `The ${input.field} we hold does not match what the candidate gave on the call, twice.`;
    if (!alreadyEscalated(call, discrepancy)) {
        await calls.appendEscalation(call, {
            question: discrepancy,
            questionKey: question?.key ?? null,
            suggestedOwner: suggestOwner(discrepancy),
            raisedTs: new Date().toISOString(),
        });
    }

    const settledSay =
        responses.mismatchAgain ??
        "Still not what we hold. Take theirs down as what they gave you, read it back once, and say the team " +
        "will check it against our record - do not tell them it is confirmed, because it is not.";

    return {
        question: question?.key,
        outcome: "mismatch",
        say: question ? await settle(stated, "mismatch", settledSay) : mismatchSay,
    };
};

const SCORE_RANGE = { min: 1, max: 5 };

// Arrives as a string more often than not, and anything outside 1-5 is dropped.
const parseScore = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= SCORE_RANGE.min && parsed <= SCORE_RANGE.max
        ? Math.round(parsed)
        : null;
};

export const recordAnswer = async (input: {
    companyId: number;
    interviewReference: string;
    questionKey: string;
    summary: string;
    rawResponse?: string;
    data?: Record<string, unknown>;
    outcome?: string;
    score?: string | number;
    /** Internal: which tool the history row is stamped with, so a checklist reads as one. */
    tool?: string;
    /** Internal: the outcome whose authored direction is handed back instead of "ask the next one". */
    authoredOutcome?: string;
}) => {
    const { call, questions, askable, sets } = await context(input.companyId, input.interviewReference);

    const question = questions.find((candidate) => candidate.key === input.questionKey);
    if (!question) throw new Error(`No question "${input.questionKey}" in this programme`);

    const outcome = (["answered", "skipped", "declined", "unclear"] as InterviewAnswerOutcome[]).includes(
        input.outcome as InterviewAnswerOutcome,
    )
        ? (input.outcome as InterviewAnswerOutcome)
        : "answered";

    const score = parseScore(input.score);

    // Fails open: an answer is never dropped because the persona skipped
    // ask_question, but the gap is traced so a script that stops calling it shows.
    const askedTs = askedTsFor(await calls.readAnswers(call), question.key);
    if (!askedTs) trace("tool", input.interviewReference, "record_without_ask", { question: question.key });

    // Same trade as the ask: the answer is stored either way, but a persona that
    // has stopped sending the verbatim has to be visible rather than silently
    // leaving the sheet with nothing but its own summaries on it.
    const rawResponse = String(input.rawResponse ?? "").trim();
    if (!rawResponse) trace("tool", input.interviewReference, "record_without_raw", { question: question.key });

    const written = {
        tool: input.tool ?? "record_answer",
        answer: String(input.summary ?? "").trim(),
        rawResponse,
        captured: input.data ?? {},
        score,
        outcome,
        pattern: patternOf(sets, question.key),
        askedTs,
    };

    const entry = answerEntry(question, { ...written, type: "QA" });
    const answers = await calls.upsertAnswer(call, entry, keepsEarlierAnswer(entry));
    await calls.appendAnswerHistory(call, historyRow(question, written));

    const authored = input.authoredOutcome ? question.responses?.[input.authoredOutcome]?.trim() : undefined;
    const after = await afterRecording(call, { sets, askable }, question, { entry, answers }, {
        authored,
        advance: !authored || input.authoredOutcome === "yes",
    });

    return {
        recorded: question.key,
        next: after.next?.key ?? null,
        remaining: after.remaining.map((candidate) => candidate.title),
        say: after.say,
    };
};

/** A checklist item is record_answer with a fixed yes/no vocabulary instead of free-form scoring. */
export const recordChecklist = async (input: {
    companyId: number;
    interviewReference: string;
    questionKey: string;
    outcome: "yes" | "no";
    summary?: string;
    rawResponse?: string;
}) =>
    recordAnswer({
        companyId: input.companyId,
        interviewReference: input.interviewReference,
        questionKey: input.questionKey,
        summary: input.summary?.trim() || input.outcome,
        rawResponse: input.rawResponse,
        data: { outcome: input.outcome },
        outcome: "answered",
        tool: "record_checklist",
        authoredOutcome: input.outcome,
    });

/** Requirement: what the documents do not cover gets flagged for a person. */
const alreadyEscalated = (call: InterviewCall, question: string): boolean =>
    (call.escalations ?? []).some(
        (held) => String(held.question ?? "").trim().toLowerCase() === question.trim().toLowerCase(),
    );

export const recordCandidateQuestion = async (input: {
    companyId: number;
    interviewReference: string;
    question: string;
    found: boolean;
    answer?: string;
}) => {
    const { call, askable } = await context(input.companyId, input.interviewReference);

    const question = input.question.trim();
    if (!question) throw new Error("record_candidate_question needs the question they asked");

    // FAQ entries are excluded by type, so reading before the upsert is fine.
    const answers = await calls.readAnswers(call);
    const asked = answers.filter((entry) => entry.type === FAQ_TYPE);
    const left = uncovered(askable, answers);

    const open = sinceJoined(answers)
        .filter((entry) => isQuestionEntry(entry) && entry.outcome === OUTCOME_ASKED)
        .pop();
    const backTo = open?.questionText
        ? ` The question you had put to them is "${toSpokenText(open.questionText)}" - put it to them again in a ` +
        `few words, then stop and wait.`
        : "";

    // A repeat updates the entry it already has rather than adding a second.
    const held = asked.find(
        (entry) => String(entry.questionText ?? "").trim().toLowerCase() === question.toLowerCase(),
    );
    const questionKey = held?.questionKey ?? `faq:${asked.length + 1}`;
    const outcome = input.found ? "answered" : "unclear";
    const answer = input.answer?.trim() ?? "";

    await calls.upsertAnswer(call, {
        questionKey,
        type: FAQ_TYPE,
        question: { body: question },
        questionText: question,
        questionPattern: null,
        expectedAnswer: null,
        answer: { body: input.found ? answer : "", rawResponse: null },
        captured: { found: input.found },
        outcome,
        recordedTs: new Date().toISOString(),
        answerSeconds: null,
    });

    await calls.appendAnswerHistory(call, {
        questionKey,
        questionText: question,
        tool: "record_candidate_question",
        outcome,
        answer,
        captured: { found: input.found },
    });

    await calls.recordKnowledgeLookup(call);

    const suggestedOwner = suggestOwner(question);
    const escalated = !input.found && !alreadyEscalated(call, question);

    if (escalated) {
        await calls.appendEscalation(call, {
            question,
            questionKey,
            suggestedOwner,
            raisedTs: new Date().toISOString(),
        });
        await applications.markEscalated(call.meeting_session_id);
    }

    trace("tool", call.interview_reference, "candidate_question", {
        question,
        found: input.found,
        escalated,
    });

    return {
        recorded: questionKey,
        found: input.found,
        escalated,
        suggestedOwner,
        say: input.found
            ? left.length
                ? `Recorded - never say this aloud. Go back to the question you had put to them and ask only that one.${backTo}`
                : "Recorded - never say this aloud. Ask whether there is anything else they would like to ask. " +
                GOODBYE_THEN_SUBMIT
            : renderTokens(ESCALATION_RESPONSES.recorded, { owner: suggestedOwner }) + (left.length ? backTo : ""),
    };
};

export const flagForStaff = async (input: {
    companyId: number;
    interviewReference: string;
    question: string;
    context?: string;
    questionKey?: string;
}) => {
    const call = await calls.findCallByReference(input.companyId, input.interviewReference.trim());
    if (!call) throw new Error(`No interview ${input.interviewReference} for this company`);
    if (!input.question.trim()) throw new Error("No question to flag - the tool call carried an empty question");

    const company = await meetingRepo.findCompany(input.companyId);
    const suggestedOwner = suggestOwner(input.question, company?.company_name);

    // Asking the same thing twice is a candidate not satisfied with the answer,
    // not two things for staff to chase, so a repeat is not recorded again.
    const alreadyRaised = (call.escalations ?? []).some(
        (held) => held.question.trim().toLowerCase() === input.question.trim().toLowerCase(),
    );
    if (!alreadyRaised) {
        const escalations = await calls.appendEscalation(call, {
            question: input.question,
            questionKey: input.questionKey ?? null,
            suggestedOwner,
            raisedTs: new Date().toISOString(),
        });
        trace("escalation", input.interviewReference, "saved", { total: escalations.length, owner: suggestedOwner });
        await applications.markEscalated(call.meeting_session_id);
    } else {
        trace("escalation", input.interviewReference, "repeat_skipped", { question: input.question });
    }

    return {
        flagged: true,
        suggestedOwner,
        say: renderTokens(ESCALATION_RESPONSES.recorded, { owner: suggestedOwner }),
    };
};

/** Where a score sits against the question's own bar. */
const VERDICTS: Record<number, string> = {
    5: "exceeds",
    4: "meets",
    3: "partially meets",
    2: "below",
    1: "well below",
};

/** What a set of questions is called in a sentence. */
const PATTERN_LABELS: Record<string, string> = {
    CHECKLIST: "the file checks",
    QUESTION_ANSWER: "the open role questions",
    SCENARIO: "the scenarios",
    GREETING: "the opening",
    INTERVIEW_CONCLUSION: "the close",
};

const standingOf = (average: number): string => {
    if (average >= 4.5) return "strong throughout";
    if (average >= 3.5) return "solid";
    if (average >= 2.5) return "mixed";
    return "weak";
};

const plural = (count: number, one: string, many: string): string =>
    `${count} ${count === 1 ? one : many}`;

/**
 * One prose judgement of the whole interview, with the per-question detail
 * returned alongside it for `captured` rather than written into the prose.
 *
 * Reports the judgement already made at record time - the persona scores each
 * answer against that question's guidance - rather than re-deriving one.
 */
const performanceSummary = (
    questions: IScriptQuestion[],
    answers: ICallAnswerEntry[],
    averageScore: number | null,
): { body: string; assessment: Record<string, unknown>[] } => {
    const byKey = new Map(answers.map((entry) => [entry.questionKey, entry]));
    const assessment: Record<string, unknown>[] = [];
    const byPattern = new Map<string, number[]>();

    for (const question of questions) {
        const entry = byKey.get(question.key);
        if (!entry || entry.type === LIFECYCLE_TYPE) continue;

        const score = typeof entry.score === "number" ? entry.score : null;
        const pattern = entry.questionPattern ?? null;

        if (score !== null && pattern) byPattern.set(pattern, [...(byPattern.get(pattern) ?? []), score]);

        assessment.push({
            questionKey: question.key,
            title: question.title,
            pattern,
            outcome: entry.outcome ?? null,
            score,
            verdict: score === null ? (entry.outcome ?? "not scored") : (VERDICTS[score] ?? "not scored"),
            expected: entry.expectedAnswer ?? question.expectedAnswer ?? null,
            gave: entry.answer?.body || entry.answer?.rawResponse || null,
        });
    }

    const scored = assessment.filter((row) => row.score !== null);
    const above = scored.filter((row) => Number(row.score) >= 4).length;
    const met = scored.filter((row) => Number(row.score) === 3).length;
    const short = scored.filter((row) => Number(row.score) <= 2).length;
    const unanswered = assessment.filter((row) => row.outcome === OUTCOME_ASKED).length;
    const declined = assessment.filter((row) => row.outcome === "declined").length;
    const unclear = assessment.filter((row) => row.outcome === "unclear").length;

    const sentences: string[] = [];

    sentences.push(
        `The candidate was asked ${plural(assessment.length, "question", "questions")}` +
        (unanswered ? `, ${unanswered} of which went unanswered` : "") +
        `, and ${scored.length ? plural(scored.length, "answer carried", "answers carried") : "no answer carried"} a score.`,
    );

    if (scored.length && averageScore !== null) {
        const parts = [
            above ? `${plural(above, "answer went", "answers went")} beyond what was asked` : "",
            met ? `${plural(met, "answer", "answers")} partially met the bar` : "",
            short ? `${plural(short, "answer fell", "answers fell")} short of it` : "",
        ].filter(Boolean);

        sentences.push(
            `Overall the interview was ${standingOf(averageScore)}: ` +
            `${parts.join(", ").replace(/, ([^,]*)$/, " and $1")}.`,
        );
    }

    // Only where more than one kind of question was scored - otherwise "strongest
    // on X" says nothing.
    const averages = [...byPattern.entries()]
        .map(([pattern, scores]) => ({
            label: PATTERN_LABELS[pattern] ?? pattern.toLowerCase().replace(/_/g, " "),
            average: scores.reduce((total, value) => total + value, 0) / scores.length,
        }))
        .sort((a, b) => b.average - a.average);

    if (averages.length > 1 && averages[0].average > averages[averages.length - 1].average) {
        sentences.push(
            `They were strongest on ${averages[0].label} and weakest on ${averages[averages.length - 1].label}.`,
        );
    }

    // Their own questions, counted but never rated - a candidate asking nothing
    // and a candidate asking six things we could not answer are different calls.
    const asked = answers.filter((entry) => entry.type === FAQ_TYPE);
    if (asked.length) {
        const fromKb = asked.filter((entry) => entry.captured?.found === true).length;
        const missed = asked.length - fromKb;

        sentences.push(
            `They asked ${plural(asked.length, "question", "questions")} of their own: ` +
            [
                fromKb ? `${fromKb} answered from the knowledge base` : "",
                missed ? `${missed} with nothing on file, left for a person to follow up` : "",
            ].filter(Boolean).join(", and ") + ". These carry no rating.",
        );
    }

    if (declined || unclear) {
        sentences.push(
            [
                declined ? `${plural(declined, "question was", "questions were")} declined` : "",
                unclear ? `${plural(unclear, "answer was", "answers were")} too vague to pin down` : "",
            ].filter(Boolean).join(", and ") + ".",
        );
    }

    sentences.push(
        averageScore === null
            ? "Nothing was scored, so no overall rating can be given."
            : `Overall rating: ${averageScore.toFixed(1)} out of 5.`,
    );

    return { body: sentences.join(" "), assessment };
};

const MAX_BASIS_LENGTH = 1000;
const MIN_BASIS_LENGTH = 150;
const THIN_BASIS_OUTCOME = "thin_basis";

const cleanBasis = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().slice(0, MAX_BASIS_LENGTH);
    return trimmed || null;
};

const bandScores = (
    bands: Record<string, string | number | undefined> | undefined,
    bases: Record<string, unknown> | undefined,
): Record<string, { score: number | null; verdict: string | null; basis: string | null }> =>
    Object.fromEntries(EVALUATION_BANDS.map((band) => {
        const score = parseScore(bands?.[band.key]);
        return [band.key, {
            score,
            verdict: score === null ? null : (VERDICTS[score] ?? null),
            basis: cleanBasis(bases?.[band.key]),
        }];
    }));

export const submitInterview = async (input: {
    companyId: number;
    interviewReference: string;
    closingNote?: string;
    bands?: Record<string, string | number | undefined>;
    bandBases?: Record<string, unknown>;
    recommendation?: string;
    evaluationSummary?: string;
}) => {
    const { call, questions, askable, sets } = await context(input.companyId, input.interviewReference);
    const responses: Record<string, string> = conclusionOf(sets)?.responses ?? {};

    if (call.call_status === "COMPLETED") {
        await calls.appendAnswerHistory(call, {
            questionKey: "submit_interview",
            tool: "submit_interview",
            outcome: "duplicate",
            answer: "already submitted",
            captured: {},
        });

        return {
            submitted: false,
            say: renderTokens(responses.alreadySubmitted ?? "Already submitted. Close warmly.", {}),
        };
    }

    // Refused rather than closed when a required question is uncovered: the
    // persona naming the gaps is what sends it back to ask them.
    const answers = await calls.readAnswers(call);
    const answered = answeredKeys(answers);
    const missing = uncovered(askable, answers);

    if (missing.length) {
        // History only: a refusal is an attempt, not an outcome, and it must not
        // leave a submitted entry on the sheet.
        await calls.appendAnswerHistory(call, {
            questionKey: "submit_interview",
            tool: "submit_interview",
            outcome: "incomplete",
            answer: `${missing.length} uncovered: ${missing.map((question) => question.key).join(", ")}`,
            captured: {},
        });

        // The close may already have been spoken - the script is re-resolved on
        // every tool call, so a gap can reappear after it. Saying so beats a bare
        // list of gaps the persona has to reconcile with a goodbye it just gave.
        const closed = (await calls.countToolCalls(call, CLOSING_INVITE_TOOL)) > 0;

        const direction = closed
            ? `You have already closed, but the record shows ${missing.length} still uncovered: ` +
            `${missing.map((question) => question.title).join(", ")}. Say there is one more thing you need ` +
            `to check, ask exactly those, then call submit_interview again.`
            : renderTokens(
                responses.incomplete ??
                "Not submitted - {{missingCount}} still have nothing recorded against them: {{missingKeys}}. " +
                "Do not call submit_interview again until each one is recorded. Where they already gave you an " +
                "answer or a reason to skip it, record that now under its key without asking again; otherwise " +
                "say there is one more thing you need to check and ask it. Then call submit_interview again.",
                {
                    missingCount: missing.length,
                    missingTitles: missing.map((question) => question.title).join(", "),
                    missingKeys: missing.map((question) => `"${question.key}"`).join(", "),
                },
            );

        const handover = await putQuestion(call, missing[0], {
            pattern: patternOf(sets, missing[0].key),
            tool: NEXT_QUESTION_TOOL,
            withIntro: false,
        });

        return {
            submitted: false,
            say: `${direction}\n\nThe first of them, as it is to be put to them:\n${handover.line}\n\n${handover.brief}`,
        };
    }

    const bands = bandScores(input.bands, input.bandBases);
    const thinBasisBands = EVALUATION_BANDS.filter(
        (band) => bands[band.key].score !== null && (bands[band.key].basis?.length ?? 0) < MIN_BASIS_LENGTH,
    );

    if (thinBasisBands.length) {
        const alreadyAsked = await calls.countToolCalls(call, "submit_interview", { outcome: THIN_BASIS_OUTCOME });

        await calls.appendAnswerHistory(call, {
            questionKey: "submit_interview",
            tool: "submit_interview",
            outcome: THIN_BASIS_OUTCOME,
            answer: `thin basis: ${thinBasisBands.map((band) => band.key).join(", ")}`,
            captured: {},
        });

        if (!alreadyAsked) {
            return {
                submitted: false,
                say:
                    `Not submitted yet. The reason given for ${thinBasisBands.map((band) => band.label).join(", ")} ` +
                    `is too short to justify the figure. Call submit_interview again with the same ratings, and for ` +
                    `each one write three or four sentences: what they did well with something they actually said, ` +
                    `what fell short with an example, and why it is that number and not one higher or lower. ` +
                    `Say nothing aloud about this.`,
            };
        }

        trace("tool", input.interviewReference, "submit_with_thin_basis", {
            bands: thinBasisBands.map((band) => band.key),
        });
    }

    const scored = [...new Map(answers.map((entry) => [entry.questionKey, entry])).values()]
        .filter((entry) => typeof entry.score === "number");
    const averageScore = scored.length
        ? scored.reduce((total, entry) => total + Number(entry.score), 0) / scored.length
        : null;
    const submittedTs = new Date();

    await calls.updateCall(call, {
        questionsTotal: questions.length,
        questionsAnswered: answered.size,
        averageScore,
        submittedTs,
    });

    const summary = performanceSummary(questions, answers, averageScore);

    const recommendation =
        HIRE_RECOMMENDATIONS.find((value) => value === input.recommendation?.toLowerCase()) ?? null;

    // Fails open like record_answer, but the gap is traced.
    const unrated = [
        ...EVALUATION_BANDS.filter((band) => bands[band.key].score === null).map((band) => band.key),
        ...(recommendation ? [] : ["recommendation"]),
    ];
    if (unrated.length) {
        trace("tool", input.interviewReference, "submit_without_evaluation", { missing: unrated });
    }

    await recordLifecycle(call, {
        tool: "submit_interview",
        outcome: "submitted",
        detail: summary.body,
        captured: {
            assessment: summary.assessment,
            averageScore,
            questionsAnswered: answered.size,
            questionsTotal: questions.length,
            evaluation: { ...bands, recommendation, summary: input.evaluationSummary?.trim() || null },
            ...(input.closingNote?.trim() ? { closingNote: input.closingNote.trim() } : {}),
        },
        at: submittedTs,
    });

    await calls.closeCall(call, "COMPLETED", { endedTs: submittedTs });

    // Ends the session outright. The persona is not asked to hang up: the system
    // end_call confirms with the candidate first, and a weak model may never fire it.
    const uuid = await meetingUuidOf(call);
    if (uuid) emitSessionEnded(uuid, { reason: "SUBMITTED" });

    const askedCount = answers.filter((entry) => entry.type === FAQ_TYPE).length;
    if (!askedCount && (call.escalations ?? []).length) {
        trace("tool", call.interview_reference, "escalation_without_question", {
            escalations: (call.escalations ?? []).length,
        });
    }

    trace("tool", call.interview_reference, "submitted", {
        at: submittedTs.toISOString(),
        questions: questions.length,
        answered: answered.size,
        averageScore,
    });

    return {
        submitted: true,
        reference: call.interview_reference,
        submittedTs: submittedTs.toISOString(),
        say: renderTokens(responses.submitted ?? GOODBYE_AFTER_SUBMIT, {}),
    };
};

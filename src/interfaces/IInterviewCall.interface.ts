/**
 * The call history: what happened on one attempt to reach a candidate.
 *
 * Two vocabularies, deliberately not one. `call_status` is how an attempt
 * ended; `meeting_join_state` is how far into the meeting it got. A call can be
 * admitted to the room and still fail, and a single column cannot say that.
 */

/** How the attempt ended. SCHEDULED and IN_PROGRESS are the only non-terminal ones. */
export type InterviewCallStatus =
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "COMPLETED"
    /** Nobody picked up, or the persona sat in the lobby until it gave up. */
    | "NO_ANSWER"
    /** The candidate declined to continue. */
    | "DECLINED"
    /** Anam never got into the room at all. */
    | "FAILED_TO_JOIN"
    /** It started and was cut short - a drop, a hang-up mid-answer. */
    | "INTERRUPTED"
    /** Left open and never resumed. Written by the retention sweep, not live. */
    | "ABANDONED"
    | "CANCELLED"
    | "FAILED";

/** Which transport carried it - a Teams-style meeting, or a VA room. */
export type InterviewCallChannel = "meeting" | "virtual_avatar";

/**
 * "guest" is anyone in the room who is not the persona and not the candidate.
 *
 * Its own role rather than folded into the candidate: the transcript is evidence
 * about the candidate, and an organiser's words filed under her name is a
 * falsified record, not an untidy one.
 */
export type InterviewCallSpeaker = "persona" | "candidate" | "guest" | "system";

/** Who was in the room, as recorded on the call. */
export interface ICallParticipant {
    role: InterviewCallSpeaker;
    name: string;
    /**
     * "expected" was known before the call - the persona and the candidate.
     * "transcript" turned up in the room and was matched to nobody.
     */
    source: "expected" | "transcript";
    /** How many turns are attributed to them, so a silent joiner is visible. */
    turns: number;
}

/** Grouped on in reporting, which is why it is a code and not the prose. */
export type InterviewCallFailureCode =
    | "JOIN_REJECTED"
    | "LOBBY_TIMEOUT"
    | "PROVIDER_ERROR"
    | "TOOL_SECRET"
    | "NO_AVATAR"
    | "CANCELLED_BY_STAFF"
    | "SESSION_SETUP_FAILED"
    | "AGENT_LEFT_EARLY"
    | "ROOM_ENDED"
    | "UNKNOWN";
export interface ICallAnswerHistoryRow {
    questionKey: string;
    questionPattern?: string | null;
    questionText?: string | null;
    expectedAnswer?: string | null;
    /** ask_question | record_answer | verify_contact */
    tool: string;
    /** asked | answered | declined | unclear | skipped | match | mismatch | missing */
    outcome?: string | null;
    answer?: string | null;
    rawResponse?: string | null;
    captured?: Record<string, unknown>;
    score?: number | null;
    askedTs?: string | null;
    secondsSinceAsked?: number | null;
}

/**
 * One entry on the answer sheet, stored as authored rather than as ids: the
 * question is kept as the wording that was actually put to the candidate, so a
 * later rewording of the script cannot change what the record says was asked.
 */
export interface ICallAnswerEntry {
    /** Which script question this is. The only field a tool matches on. */
    questionKey: string;
    /** QA | VERIFICATION | ESCALATION - what kind of exchange this was. */
    type: string;
    /** The question's title. questionText is the wording actually put to them. */
    question: { body: string };
    questionText?: string | null;
    /** CHECKLIST | QUESTION_ANSWER | SCENARIO - which set this came out of. */
    questionPattern?: string | null;
    /** What a good answer covers. Never returned by an endpoint. */
    expectedAnswer?: string | null;
    answer: { body: string; rawResponse: string | null };
    /** Named fields the script asked to capture, when it asked for any. */
    captured?: Record<string, unknown>;
    /** The rating. Only where the question sets ratingRequired. */
    score?: number | null;
    /** asked | answered | declined | unclear | skipped */
    outcome?: string;
    /** When ask_question put it to them. Absent on an answer recorded without one. */
    askedTs?: string;
    recordedTs?: string;
    /** How long they took, askedTs to recordedTs. Null where the ask was not timed. */
    answerSeconds?: number | null;
    joinNo?: number;
}
export interface ICallAnswerView {
    /** Stable per call, so a list can key on it rather than on the wording. */
    questionKey: string;
    questionPattern: string | null;
    answer: { body: string; rawResponse: string | null };
    outcome: string | null;
    score: number | null;
    /**
     * When the question was put. Falls back to recordedTs on an entry that was
     * never asked - a candidate's own question, or a lifecycle event.
     */
    askedTs: string | null;
}

/** A question the persona could not answer and promised to pass on. */
export interface ICallEscalation {
    question: string;
    /** Where it came up, when it came up inside a question rather than at the end. */
    questionKey?: string | null;
    suggestedOwner: string;
    raisedTs: string;
}

export interface ISessionEscalation extends ICallEscalation {
    callId: number;
    reference: string;
    attemptNo: number;
}

export interface ISessionEscalationsView {
    sessionReference: string;
    total: number;
    escalations: ISessionEscalation[];
}

/** Opening a call. Everything else about it is written as the call progresses. */
export interface IOpenCallInput {
    companyId: number;
    meetingSessionId: number;
    personaProgramId: number;
    interviewReference: string;
    channel: InterviewCallChannel;
    jobShortCode?: string | null;
    jobLabel?: string | null;
    atsSystem?: string | null;
    atsCandidateId?: string | null;
    personaKey?: string | null;
    personaRole?: string | null;
    anamAvatarId?: number | null;
    avatarKey?: string | null;
    avatarDisplayName?: string | null;
    avatarModel?: string | null;
    voiceId?: string | null;
    candidateName?: string | null;
    candidateEmail?: string | null;
    candidatePhone?: string | null;
    kbFolder?: string | null;
    kbDomain?: string | null;
    scriptHash?: string | null;
    roomInitiatedTs?: Date | null;
    /** Known at the open, because the script is resolved before the call starts. */
    questionsTotal?: number | null;
}

/** Only the fields supplied are written, so a status refresh blanks nothing. */
export interface IUpdateCallInput {
    callStatus?: InterviewCallStatus;
    participants?: ICallParticipant[];
    failureCode?: InterviewCallFailureCode | null;
    failureReason?: string | null;
    errorPayload?: Record<string, unknown> | null;
    joinedTs?: Date | null;
    answeredTs?: Date | null;
    declinedTs?: Date | null;
    submittedTs?: Date | null;
    endedTs?: Date | null;
    recordingId?: string | null;
    recordingStatus?: string | null;
    recordingBucket?: string | null;
    recordingKey?: string | null;
    recordingExpiresTs?: Date | null;
    questionsTotal?: number | null;
    questionsAnswered?: number | null;
    averageScore?: number | null;
}

export interface ICallFailureInput {
    code: InterviewCallFailureCode;
    reason: string;
    stage: string;
    error?: unknown;
    detail?: Record<string, unknown>;
    closeAs?: InterviewCallStatus;
    declined?: boolean;
}

/** One line of the transcript, as it is stored. */
export interface ICallTurnInput {
    role: InterviewCallSpeaker;
    /** The provider's own name for the speaker, when it distinguishes them. */
    speakerLabel?: string | null;
    content: string;
    /** BCP-47 as the provider reported it: "es", "es-MX". Null when unreported. */
    languageCode?: string | null;
    languageName?: string | null;
    spokenTs?: Date | null;
    startOffsetMs?: number | null;
    endOffsetMs?: number | null;
    questionKey?: string | null;
}

export interface ICallTurnView {
    index: number;
    role: InterviewCallSpeaker;
    speaker: string;
    speakerConfirmed: boolean;
    content: string;
    languageCode: string | null;
    languageName: string | null;
    spokenAt: string | null;
    startOffsetMs: number | null;
    endOffsetMs: number | null;
    questionKey: string | null;
}

/**
 * A call as the API returns it. Contact details are masked here as they are
 * everywhere else - the history is read by the same people who speak to
 * candidates, and it is not the place raw contact details start leaking.
 */
export interface IInterviewCallView {
    id: number;
    reference: string;
    attemptNo: number;
    status: InterviewCallStatus;
    channel: InterviewCallChannel;
    jobLabel: string | null;
    candidate: {
        candidateId: string | null;
        name: string | null;
        emailMasked: string;
        phoneMasked: string;
        atsSystem: string | null;
        atsCandidateId: string | null;
    };
    persona: {
        key: string | null;
        role: string | null;
        avatarKey: string | null;
        displayName: string | null;
        avatarModel: string | null;
        voiceId: string | null;
    };
    knowledge: {
        folder: string | null;
        domain: string | null;
        lookups: number;
    };
    /** Who was in the room. A `guest` here is someone nobody invited to be recorded. */
    participants: ICallParticipant[];
    timeline: {
        roomInitiatedAt: string | null;
        initiatedAt: string;
        joinedAt: string | null;
        answeredAt: string | null;
        declinedAt: string | null;
        /** When submit_interview ran. Null on a call that never submitted. */
        submittedAt: string | null;
        endedAt: string | null;
        durationSeconds: number | null;
    };
    recording: {
        id: string | null;
        status: string | null;
        bucket: string | null;
        key: string | null;
        expiresAt: string | null;
    };
    outcome: {
        questionsTotal: number | null;
        questionsAnswered: number | null;
        averageScore: number | null;
        interruptedCount: number;
        failureCode: string | null;
        failureReason: string | null;
        errorPayload: Record<string, unknown> | null;
    };
    scriptHash: string | null;
    /** What the persona could not answer. Small, so it rides along on a listing. */
    escalations: ICallEscalation[];
    /** Only on the single-call read; a listing would be enormous. */
    transcript?: ICallTurnView[];
    /** Also single-call only, for the same reason. */
    answers?: ICallAnswerEntry[];
}

export interface IRawTranscriptEvent {
    at: string;
    type: string;
    data?: unknown;
    attemptId?: string;
}

export interface IRawTranscriptBody {
    ref: string;
    attemptId: string;
    events: IRawTranscriptEvent[];
}

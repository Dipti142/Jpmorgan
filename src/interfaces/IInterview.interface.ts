/** How a question was left. Was an enum on the deleted answer table. */
export type InterviewAnswerOutcome = "answered" | "declined" | "unclear" | "skipped";

/** What the console lists in the interpreter picker. */
export interface IVendorListItem {
    id: number;
    name: string;
    languages: string[];
    answered: number;
    total: number;
    interviewStatus: string;
    reference: string | null;
}

/** One question as the console renders it, with whatever was recorded against it. */
export interface IInterviewQuestionView {
    key: string;
    title: string;
    kind: string;
    required: boolean;
    order: number;
    captureFields: string[];
    /** Already resolved against the heading, so no caller applies the rule twice. */
    ratingRequired: boolean;
    answer: {
        outcome: InterviewAnswerOutcome;
        summary: string | null;
        data: Record<string, unknown>;
        score: number | null;
        recordedAt: string;
    } | null;
}

/**
 * One heading and its questions. expected_answer is deliberately not here - it
 * is the bar a candidate is judged against, and the console is open to people
 * who also speak to candidates.
 */
export interface IInterviewChecklistView {
    key: string;
    title: string;
    kind: string;
    order: number;
    ratingRequired: boolean;
    jobId: number | null;
    jobLabel: string | null;
    questions: IInterviewQuestionView[];
}

/** Who speaks, to whom, from which script - everything settled before a call opens. */
export interface IStartSessionRequest {
    companyId?: number;
    personaKey?: string;
    vendorId: number;
    /** Recorded on the call. Not what picks the script - jobShortCode is. */
    jobId?: number | null;
    /** Which job role's custom script to run. Omit for the company's default one. */
    jobShortCode?: string | null;
    jobLabel?: string | null;
    avatarKey?: string;
    consentVersion?: string;
}

/**
 * The above plus where to go.
 *
 * Kept as an extension rather than one flat shape: a calendar watcher can fill
 * meetingUrl and joinAt in later without touching how a session is prepared.
 */
export interface IStartMeetingRequest extends IStartSessionRequest {
    meetingUrl: string;
    /** Omit to join now. Anam accepts at most 7 days ahead. */
    joinAt?: Date | null;
    /**
     * Record the call for playback. Covers the whole session or none of it -
     * there is no way to start recording partway through.
     */
    recordSession?: boolean;
}

/** A meeting as the API reports it. */
export interface IMeetingView {
    inviteId: string;
    provider: string;
    meetingUrl: string;
    displayName: string | null;
    status: string;
    /** joining | waiting_room | in_call | left. Null until Anam reports one. */
    joinState: string | null;
    /** Null until the persona joins. Needed before a transcript exists. */
    sessionId: string | null;
    statusReason: string | null;
}

/**
 * What the interviewer is told about the person before the call opens.
 *
 * The gaps matter more than the facts: they are what turns "tell me about
 * yourself" into "your file doesn't show any medical settings - have you
 * worked in one?".
 */
export interface IResumeBrief {
    firstName: string;
    fullName: string;
    headline: string[];
    gaps: string[];
}

/** Every tool call arrives with this, so the webhook can find its call. */
export interface IToolCallBody {
    interviewReference?: string;
    [key: string]: unknown;
}

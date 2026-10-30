export type TimelineTrack =
    | "SCHEDULING"
    | "EMAIL_NOTIFICATION"
    | "MEETING_LIFECYCLE"
    | "PARTICIPANT_ADMISSION"
    | "AI_INTERVIEWER"
    | "AZURE_CALLING"
    | "MEETING_RECORDING"
    | "INTERVIEW_TOOL_CALL"
    | "TRANSCRIPT_CAPTURE"
    | "ESCALATION"
    | "RECRUITER_REVIEW"
    | "OTHER";

export type TimelineProvider = "GRAPH" | "SMTP" | "ACS" | "ANAM" | "WORKABLE" | "SYSTEM" | "STAFF";

export type TimelineSuccessOutcome = "OK" | "SKIPPED" | "RETRIED";

export type TimelineOutcome = TimelineSuccessOutcome | "FAILED";

export type TimelineActorType = "SYSTEM" | "PARTICIPANT" | "STAFF" | "PROVIDER";

export interface ITimelineActor {
    type: TimelineActorType;
    id: number | null;
}

interface ITimelineEntryBase {
    seq: number;
    occurred_ts: string;
    track: TimelineTrack;
    provider: TimelineProvider;
    event_type: string;
    from_status?: string | null;
    to_status?: string | null;
    actor?: ITimelineActor;
    note?: string;
    message: string;
    details: Record<string, unknown>;
}

export interface ITimelineEvent extends ITimelineEntryBase {
    outcome: TimelineSuccessOutcome;
}

export interface ITimelineError extends ITimelineEntryBase {
    outcome: "FAILED";
    error_code: string;
    error_message: string;
}

export type TimelineDraft = Omit<ITimelineEvent, "seq"> | Omit<ITimelineError, "seq">;

export interface IMeetingHistoryEntryView {
    step: number;
    occurredAt: string;
    track: TimelineTrack;
    provider: TimelineProvider;
    eventType: string;
    outcome: TimelineOutcome;
    fromStatus: string | null;
    toStatus: string | null;
    actorType: TimelineActorType | null;
    actorId: number | null;
    message: string;
    note: string | null;
    details: Record<string, unknown>;
    errorCode: string | null;
    errorMessage: string | null;
    open: boolean | null;
}

export interface IMeetingHistorySummary {
    total: number;
    failed: number;
    openFailures: number;
    failedTracks: TimelineTrack[];
}

export interface IMeetingHistoryQuery {
    outcome?: TimelineOutcome;
    limit: number;
    offset: number;
}

export interface IMeetingHistoryView {
    sessionReference: string;
    finalStatus: string | null;
    summary: IMeetingHistorySummary;
    total: number;
    limit: number;
    offset: number;
    entries: IMeetingHistoryEntryView[];
}

export interface IMeetingScope {
    companyId: number;
    meetingSessionId: number;
}

export interface IHistoryScope {
    companyId: number;
    meetingSessionId: number;
    interviewCallId?: number | null;
    reference?: string;
}

export interface IHistoryEntryInput {
    track: TimelineTrack;
    provider: TimelineProvider;
    eventType: string;
    message: string;
    outcome?: TimelineSuccessOutcome;
    fromStatus?: string | null;
    toStatus?: string | null;
    actor?: ITimelineActor;
    note?: string;
    details?: Record<string, unknown>;
    recipientEmail?: string;
    errorCode?: string;
}

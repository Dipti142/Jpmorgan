export type MeetingRole = "AGENT" | "ORGANIZER" | "CANDIDATE" | "GUEST";

export type MeetingStatus =
    | "SCHEDULED"
    | "RESCHEDULED"
    | "ACTIVE"
    | "ENDED"
    | "EXPIRED"
    | "REVOKED"
    | "CANCELLED";

export type VaScheduleStatus =
    | "UNASSIGNED"
    | "SCHEDULED"
    | "RESCHEDULED"
    | "ONGOING"
    | "COMPLETED"
    | "MISSED"
    | "INTERRUPTED"
    | "CANCELLED";

export type AiRecommendationStatus = "PASSED" | "FAILED" | "ONHOLD";

export interface IAiRecommendationStatusSeed {
    status_code: AiRecommendationStatus;
    status_label: string;
    client_status_label: string;
    display_order: number;
}

export interface IAiRecommendationStatusView {
    code: AiRecommendationStatus;
    label: string;
    clientLabel: string;
    order: number;
}

export interface IVaMeetingStatusSeed {
    status_code: VaScheduleStatus;
    status_label: string;
    client_status_label: string;
    meeting_status_code: MeetingStatus | null;
    display_order: number;
}

export interface IVaMeetingStatusView {
    code: VaScheduleStatus;
    label: string;
    clientLabel: string;
    meetingStatus: MeetingStatus | null;
    order: number;
}

export type MeetingEmailStatus ="PENDING" | "SENT" | "FAILED";

export type MeetingAdmissionState = "INVITED" | "PENDING" | "ADMITTED" | "DENIED" | "LEFT";

export type MeetingAcsRole = "Presenter" | "Attendee" | "Consumer";

export type MeetingDenialReason = "DENIED_BY_ORGANISER" | "LOBBY_TIMEOUT" | "ROOM_FULL";

export interface IMeetingRecipient {
    email: string;
    displayName: string | null;
}

export interface ICreateMeetingFromInvite {
    icsUid: string | null;
    topic: string | null;
    startsAt: Date;
    endsAt: Date | null;
    recipients: IMeetingRecipient[];
    sourceMessageId: string | null;
}

export interface ICancelMeetingFromInvite {
    icsUid: string | null;
    sourceMessageId: string | null;
}

export interface IMeetingWindow {
    startsAt: Date;
    endsAt: Date;
}

export interface IMeetingParticipantView {
    participantId: number;
    email: string;
    displayName: string | null;
    role: MeetingRole;
    candidateId: string | null;
    sessionLink: string;
    emailStatus: MeetingEmailStatus;
}

export interface IMeetingJoinCredentials {
    participantId: number;
    sessionReference: string;
    displayName: string;
    role: MeetingRole;
    acsRole: MeetingAcsRole;
    acsEndpoint: string;
    roomId: string;
    chatThreadId: string | null;
    communicationUserId: string;
    acsToken: string;
    acsTokenExpiresOn: string;
    roomValidUntil: string;
}

export interface IGuestRegistration {
    ref: string;
    email: string;
    displayName: string;
}

export interface IGuestRegistered {
    guestRef: string;
    participantId: number;
    sessionReference: string;
    displayName: string;
    role: MeetingRole;
}

/** What an organiser's tab gets back when it offers to send the AI agent in. */
export interface IMeetingAgentHandoff {
    /** The agent's own invite token - only to the one tab that won the right to host it. */
    agentRef: string | null;
    /** HOSTING: send it in. The others say why not. */
    outcome: "HOSTING" | "ALREADY_IN" | "NO_AGENT" | "DENIED";
}

export interface IMeetingLobbyEntry {
    participantId: number;
    displayName: string;
    emailMasked: string;
    role: MeetingRole;
    requestedAt: string;
}

export interface IMeetingSessionView {
    meetingSessionId: number;
    uuid: string;
    topic: string | null;
    startsAt: string;
    endsAt: string | null;
    roomId: string | null;
    publicLink: string | null;
    meetingStatus: MeetingStatus;
    participants: IMeetingParticipantView[];
    alreadyExisted: boolean;
}

export type MeetingRecordingStatus = "STARTED" | "STOPPED" | "FILE_READY" | "STORED" | "FAILED";

export type MeetingTranscriptionStatus = "ACTIVE" | "PAUSED" | "STOPPED" | "FAILED";

export interface IMeetingTranscriptLine {
    lineId: number;
    participantId: number | null;
    speakerName: string;
    language: string;
    text: string;
    translations: Record<string, string>;
    at: string;
}

export interface IMeetingTranscriptEntry extends IMeetingTranscriptLine {
    speakerRole: MeetingRole | null;
    offsetSeconds: number;
}

export interface IMeetingTranscriptView {
    sessionReference: string;
    startedAt: string | null;
    total: number;
    lines: IMeetingTranscriptEntry[];
}

export interface IMeetingRecordingView {
    recordingId: number;
    sessionReference: string;
    status: MeetingRecordingStatus;
    meetingRecordingStatus: number;
    meetingJoinAttempts: number;
    fileName: string | null;
    storageKind: "local" | "gateway" | null;
    storageUrl: string | null;
    sizeBytes: number | null;
    partCount: number;
    startedAt: string | null;
    stoppedAt: string | null;
    storedAt: string | null;
    failureReason: string | null;
}

export interface IMeetingRecordingLink extends IMeetingRecordingView {
    signedUrl: string | null;
    expiresAt: string | null;
}

/** One byte slice of a recording. Concatenated in index order they are the original file. */
export interface IRecordingPart {
    index: number;
    path: string;
    sizeBytes: number;
}

export interface IStoredRecording {
    storageKind: "gateway";
    storagePath: string;
    storageUrl: string | null;
    fileName: string;
    sizeBytes: number;
    parts: IRecordingPart[];
}

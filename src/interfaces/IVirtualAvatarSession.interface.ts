export type VirtualAvatarParticipantRole = "ORGANISER" | "AGENT" | "GUEST";

/** INVITED = emailed, link not opened yet. PENDING = an agent waiting in the lobby. */
export type VirtualAvatarAdmissionState = "INVITED" | "PENDING" | "ADMITTED" | "DENIED" | "LEFT";

export type VirtualAvatarProvisionState = "RESERVED" | "JOINED" | "FAILED";

export type VirtualAvatarInviteStatus = "PENDING" | "SENT" | "FAILED";

/** Which slot on the roster this person came from. */
export type VirtualAvatarRosterSource = "candidate" | "agent" | "employee";

export type VirtualAvatarSessionStatus = "ACTIVE" | "ENDED" | "EXPIRED" | "REVOKED";

/** ACS Rooms' vocabulary. Governs media only, never admit/deny. */
export type VirtualAvatarAcsRole = "Presenter" | "Attendee" | "Consumer";

export type VirtualAvatarDenialReason = "DENIED_BY_ORGANISER" | "LOBBY_TIMEOUT" | "ROOM_FULL";

/* -- the roster ----------------------------------------------------------- */

export interface IVirtualAvatarEmployeeEntry {
    name: string;
    email: string;
}

export interface ICreateVirtualAvatarSessionInput {
    companyId: number;
    topic?: string;
    scheduledFor?: Date;
    personaId?: number;
    candidateName?: string;
    candidateEmail?: string;
    agentName?: string;
    agentEmail?: string;
    employees?: IVirtualAvatarEmployeeEntry[];
    maxParticipants?: number;
    ttlMinutes?: number;
    recordSession?: boolean;
}

export interface IVirtualAvatarRosterView {
    meetingReference: string;
    meetingTopic: string | null;
    meetingRoomId: string | null;
    meetingScheduledAt: string | null;
    personaId: number | null;
    candidateName: string | null;
    candidateEmail: string | null;
    agentName: string | null;
    agentEmail: string | null;
    employeeNames: string[];
    employeeEmails: string[];
}

/* -- invites -------------------------------------------------------------- */

/** One row of the tracking table: who, what link, what happened to it. */
export interface IVirtualAvatarInviteView {
    participantId: number;
    name: string;
    email: string;
    role: VirtualAvatarParticipantRole;
    rosterSource: VirtualAvatarRosterSource | null;
    inviteLink: string | null;
    roomId: string | null;
    inviteStatus: VirtualAvatarInviteStatus;
    inviteSentAt: string | null;
    inviteError: string | null;
    admissionState: VirtualAvatarAdmissionState;
    acsRole: VirtualAvatarAcsRole | null;
    seatNo: number | null;
    joinedAt: string | null;
    leftAt: string | null;
    deniedReason: VirtualAvatarDenialReason | null;
}

export interface IVirtualAvatarSessionCreatedView {
    sessionId: number;
    sessionReference: string;
    topic: string | null;
    roomId: string | null;
    maxParticipants: number;
    recordingRequested: boolean;
    expiresAt: string;
    roomValidUntil: string;
    roster: IVirtualAvatarRosterView;
    invites: IVirtualAvatarInviteView[];
}

export interface IVirtualAvatarSessionView {
    sessionId: number;
    sessionReference: string;
    topic: string | null;
    sessionStatus: VirtualAvatarSessionStatus;
    roomId: string | null;
    maxParticipants: number;
    seatsUsed: number;
    seatsRemaining: number;
    recordingRequested: boolean;
    expiresAt: string;
    roomValidUntil: string | null;
    createdAt: string;
    endedAt: string | null;
    roster: IVirtualAvatarRosterView | null;
    invites: IVirtualAvatarInviteView[];
}

/* -- joining -------------------------------------------------------------- */

/**
 * What the page reads when the link is opened. The role is already decided, so
 * there is nothing to type and nothing to prove.
 */
export interface IVirtualAvatarJoinPreflight {
    sessionReference: string;
    topic: string | null;
    sessionStatus: VirtualAvatarSessionStatus;
    joinable: boolean;
    displayName: string;
    role: VirtualAvatarParticipantRole;
    entersLobby: boolean;
    seatsRemaining: number;
    expiresAt: string;
    recordingRequested: boolean;
}

export interface IVirtualAvatarJoinCredentials {
    participantId: number;
    sessionReference: string;
    displayName: string;
    role: VirtualAvatarParticipantRole;
    acsRole: VirtualAvatarAcsRole;
    acsEndpoint: string;
    roomId: string;
    chatThreadId: string | null;
    communicationUserId: string;
    acsToken: string;
    acsTokenExpiresOn: string;
    roomValidUntil: string;
}

export interface IVirtualAvatarJoinPending {
    state: "PENDING";
    participantId: number;
    sessionReference: string;
    displayName: string;
    role: VirtualAvatarParticipantRole;
}

export type IVirtualAvatarJoinResult = ({ state: "ADMITTED" } & IVirtualAvatarJoinCredentials) | IVirtualAvatarJoinPending;

/** "conversation" means no interview script resolved and the persona is just present. */
export type VirtualAvatarScriptMode = "custom" | "default" | "conversation";

/** What the bridge needs to start an Anam session. The API key never leaves the service. */
export interface IVirtualAvatarPersonaTokenView {
    sessionToken: string;
    /** The drawn avatar's display name - what the persona speaks as. */
    personaName: string;
    /** Which script the persona was actually given, so a test can check it without reading logs. */
    scriptMode: VirtualAvatarScriptMode;
    /** The candidate's job code that selected it, null when none was found. */
    jobShortCode: string | null;
    /** The company-prefixed tool names this session attached, so the browser can register the client ones. */
    toolNames: string[];
}

export type PersonaJoinLogLevel = "INFO" | "WARN" | "ERROR";

export interface IPersonaJoinLogEvent {
    attemptId: string;
    at: string;
    level: PersonaJoinLogLevel;
    stage: string;
    message: string;
    detail?: Record<string, unknown>;
}

export interface IPersonaJoinLogEntry {
    attempt_id: string;
    level: PersonaJoinLogLevel;
    stage: string;
    message: string;
    details: Record<string, unknown> | null;
    occurred_ts: string;
    received_ts: string;
}

export interface IPersonaJoinLogBody {
    ref: string;
    events: IPersonaJoinLogEvent[];
}

/* -- the lobby ------------------------------------------------------------ */

export interface IVirtualAvatarLobbyEntry {
    participantId: number;
    displayName: string;
    emailMasked: string;
    role: VirtualAvatarParticipantRole;
    requestedAt: string;
}

export interface IVirtualAvatarDecisionInput {
    sessionReference: string;
    participantId: number;
    /** The organiser making the call, identified by their own invite token. */
    organiserRef: string;
    decision: "ADMIT" | "DENY";
    reason?: string;
}

/* -- recordings ----------------------------------------------------------- */

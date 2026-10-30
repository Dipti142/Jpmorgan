import { IAnamPersonaConfig } from "./IAnamPersona.interface";

export type AnamMeetingRegion = "eu" | "us-east" | "us-west";
export type MeetingProvider = "teams" | "zoom" | "meet";

export type AnamMeetingStatus = "pending" | "active" | "cancelled" | "ended" | "failed";

export type AnamVideoQuality = "low" | "medium" | "high";

export interface IAnamSessionOptions {
    sessionReplay?: {
        enableSessionReplay?: boolean;
    };
    videoQuality?: AnamVideoQuality;
    videoWidth?: number;
    videoHeight?: number;
}

export interface IAnamSessionTokenRequest {
    personaConfig: IAnamPersonaConfig;
    sessionOptions?: IAnamSessionOptions;
    clientLabel?: string;
}

export interface IAnamSessionTokenResponse {
    sessionToken: string;
}

export interface IAnamMeetingInviteRequest {
    meetingUrl: string;
    personaConfig?: IAnamPersonaConfig;
    personaId?: string;
    displayName?: string;
    region?: AnamMeetingRegion;
    regionPolicy?: "preferred" | "strict";
    joinAt?: string;
    groupCall?: boolean;
    sessionOptions?: IAnamSessionOptions;
    clientLabel?: string;
}

export interface IAnamMeetingInvite {
    id: string;
    provider: string;
    meetingUrl: string;
    displayName: string | null;
    status: AnamMeetingStatus;
    sessionId: string | null;
    joinState: string | null;
    statusReason: string | null;
}


// message/timestamp are what GET /sessions/{id}/transcript documents today;
// the rest are kept as fallbacks since Anam has changed this shape before.
export interface IAnamTranscriptTurn {
    role?: string;
    message?: string;
    content?: string;
    timestamp?: string;
    language?: string;
    languageCode?: string;
    lang?: string;
    locale?: string;
    speaker?: string;
    speakerName?: string;
    participant?: string;
    participantName?: string;
    [key: string]: unknown;
}

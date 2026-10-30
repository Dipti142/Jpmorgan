import { envelope } from "./commonSchema";

export const teamsSchemas = {
    Meeting: {
        type: "object",
        properties: {
            inviteId: { type: "string", description: "Anam's invite id." },
            provider: { type: "string", enum: ["teams", "zoom", "meet"] },
            meetingUrl: { type: "string" },
            displayName: { type: "string", nullable: true, description: 'Roster name. Anam appends its own "(AI)".' },
            status: { type: "string", enum: ["pending", "active", "cancelled", "ended", "failed"] },
            joinState: {
                type: "string",
                nullable: true,
                enum: ["joining", "waiting_room", "in_call", "left"],
                description: "waiting_room means the lobby is holding it and a human must admit it.",
            },
            sessionId: { type: "string", nullable: true, description: "Null until the persona joins." },
            statusReason: { type: "string", nullable: true },
        },
    },

    CreateMeetingRequest: {
        type: "object",
        required: ["companyId", "vendorId", "meetingUrl"],
        properties: {
            companyId: { type: "integer", example: 7 },
            vendorId: { type: "integer", example: 42 },
            meetingUrl: {
                type: "string",
                maxLength: 2000,
                description: "Teams, Zoom or Google Meet join link. Any other host is rejected.",
                example: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc",
            },
            joinAt: { type: "string", format: "date-time", description: "At most 7 days ahead. Omit to join now." },
            recordSession: {
                type: "boolean",
                default: false,
                description: "Covers the whole call - Anam cannot start recording partway through.",
            },
            personaKey: { type: "string", maxLength: 50 },
            avatarKey: { type: "string", maxLength: 50, description: "Pin a face. Omit to draw from the active pool." },
            jobShortCode: { type: "string", maxLength: 50, description: "Picks the job role's own script." },
            jobId: { type: "integer", description: "Recorded only. Selects nothing." },
            jobLabel: { type: "string", maxLength: 150 },
            consentVersion: { type: "string", maxLength: 20 },
        },
    },

    CreateMeetingResponse: envelope({
        meeting: { $ref: "#/components/schemas/Meeting" },
        recording: { type: "boolean" },
        personaName: { type: "string", description: "Off the drawn avatar row." },
        toolNames: { type: "array", items: { type: "string" } },
    }),

    GetMeetingResponse: envelope({
        meeting: { $ref: "#/components/schemas/Meeting" },
        reference: { type: "string", example: "INT-7-42-3" },
    }),

    GetTranscriptResponse: envelope({
        reference: { type: "string" },
        sessionId: { type: "string" },
        transcript: {
            type: "array",
            items: {
                type: "object",
                properties: { role: { type: "string" }, content: { type: "string" } },
            },
        },
    }),

    ReconcileResponse: envelope({
        checked: { type: "integer" },
        closed: { type: "integer" },
        stillRunning: { type: "integer" },
        failed: { type: "integer", description: "Anam could not be reached for these." },
    }),

    GraphNotification: {
        type: "object",
        properties: {
            value: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        subscriptionId: { type: "string" },
                        clientState: {
                            type: "string",
                            description: "Must match TEAMS_CLIENT_STATE or the notification is dropped.",
                        },
                        changeType: { type: "string", example: "created" },
                        resourceData: {
                            type: "object",
                            properties: { id: { type: "string", description: "The message id to fetch." } },
                        },
                        lifecycleEvent: {
                            type: "string",
                            enum: ["subscriptionRemoved", "reauthorizationRequired", "missed"],
                        },
                    },
                },
            },
        },
    },
};

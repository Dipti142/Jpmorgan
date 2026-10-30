import { envelope, flatEnvelope, flatListOf, dataOf, listOf } from "./commonSchema";

const participantRole = { type: "string", enum: ["ORGANISER", "AGENT", "GUEST"] };

// The link is the whole credential, so every join endpoint takes this and nothing else.
const inviteToken = {
    type: "string",
    minLength: 32,
    maxLength: 64,
    pattern: "^[A-Za-z0-9_-]+$",
    description: "base64url invite token from the recipient's email link.",
};

export const virtualAvatarSchemas = {
    VirtualAvatarRoster: {
        type: "object",
        properties: {
            meetingReference: { type: "string" },
            meetingTopic: { type: "string", nullable: true },
            meetingRoomId: { type: "string", nullable: true },
            meetingScheduledAt: { type: "string", format: "date-time", nullable: true },
            personaId: { type: "integer", nullable: true },
            candidateName: { type: "string", nullable: true },
            candidateEmail: { type: "string", nullable: true },
            agentName: { type: "string", nullable: true },
            agentEmail: { type: "string", nullable: true },
            employeeNames: { type: "array", items: { type: "string" } },
            employeeEmails: { type: "array", items: { type: "string" } },
        },
    },

    VirtualAvatarInvite: {
        type: "object",
        properties: {
            participantId: { type: "integer" },
            name: { type: "string" },
            email: { type: "string" },
            role: participantRole,
            rosterSource: { type: "string", nullable: true, enum: ["candidate", "agent", "employee"] },
            inviteLink: { type: "string", nullable: true },
            roomId: { type: "string", nullable: true },
            inviteStatus: { type: "string", enum: ["PENDING", "SENT", "FAILED"] },
            inviteSentAt: { type: "string", format: "date-time", nullable: true },
            inviteError: { type: "string", nullable: true },
            admissionState: {
                type: "string",
                enum: ["INVITED", "PENDING", "ADMITTED", "DENIED", "LEFT"],
                description: "INVITED = emailed, link not opened. PENDING = an agent waiting in the lobby.",
            },
            acsRole: {
                type: "string",
                nullable: true,
                enum: ["Presenter", "Attendee", "Consumer"],
                description: "ACS media rights only. Never governs admit or deny.",
            },
            seatNo: { type: "integer", nullable: true },
            joinedAt: { type: "string", format: "date-time", nullable: true },
            leftAt: { type: "string", format: "date-time", nullable: true },
            deniedReason: {
                type: "string",
                nullable: true,
                enum: ["DENIED_BY_ORGANISER", "LOBBY_TIMEOUT", "ROOM_FULL"],
            },
        },
    },

    VirtualAvatarSession: {
        type: "object",
        properties: {
            sessionId: { type: "integer" },
            sessionReference: { type: "string", format: "uuid" },
            topic: { type: "string", nullable: true },
            sessionStatus: { type: "string", enum: ["ACTIVE", "ENDED", "EXPIRED", "REVOKED", "CANCELLED"] },
            roomId: { type: "string", nullable: true },
            maxParticipants: { type: "integer" },
            seatsUsed: { type: "integer" },
            seatsRemaining: { type: "integer" },
            recordingRequested: { type: "boolean" },
            expiresAt: { type: "string", format: "date-time" },
            roomValidUntil: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            endedAt: { type: "string", format: "date-time", nullable: true },
            roster: { allOf: [{ $ref: "#/components/schemas/VirtualAvatarRoster" }], nullable: true },
            invites: { type: "array", items: { $ref: "#/components/schemas/VirtualAvatarInvite" } },
        },
    },

    VirtualAvatarLobbyEntry: {
        type: "object",
        properties: {
            participantId: { type: "integer" },
            displayName: { type: "string" },
            emailMasked: { type: "string", example: "m***@example.com" },
            role: participantRole,
            requestedAt: { type: "string", format: "date-time" },
        },
    },

    MeetingRecording: {
        type: "object",
        properties: {
            recordingId: { type: "integer" },
            sessionReference: { type: "string" },
            status: { type: "string", enum: ["STARTED", "STOPPED", "FILE_READY", "STORED", "FAILED"] },
            meetingRecordingStatus: {
                type: "integer",
                enum: [0, 1],
                description:
                    "1 for the session's current recording, 0 for one from an earlier join that a rejoin on " +
                    "the same link superseded. Superseded recordings are kept.",
            },
            meetingJoinAttempts: {
                type: "integer",
                description: "Which join of the session made this recording: 0 for the first join, 1 for the first rejoin, ...",
            },
            fileName: { type: "string", nullable: true },
            storageKind: {
                type: "string",
                nullable: true,
                enum: ["local", "gateway"],
                description:
                    "Always gateway on anything stored now. local is a legacy row from before recordings went " +
                    "straight to the object store, and cannot be presigned or played.",
            },
            storageUrl: {
                type: "string",
                nullable: true,
                description:
                    "Always null. A gateway link expires, so none is stored - play or download through /v1/va/recordings/{recordingId}/file, which mints a fresh one per request.",
            },
            sizeBytes: { type: "integer", nullable: true },
            startedAt: { type: "string", format: "date-time", nullable: true },
            stoppedAt: { type: "string", format: "date-time", nullable: true },
            storedAt: { type: "string", format: "date-time", nullable: true },
            failureReason: { type: "string", nullable: true },
        },
    },

    MeetingRecordingLink: {
        type: "object",
        properties: {
            recordingId: { type: "integer" },
            sessionReference: { type: "string" },
            status: { type: "string", enum: ["STARTED", "STOPPED", "FILE_READY", "STORED", "FAILED"] },
            meetingRecordingStatus: {
                type: "integer",
                enum: [0, 1],
                description:
                    "1 for the session's current recording, 0 for one from an earlier join that a rejoin on " +
                    "the same link superseded. Superseded recordings are kept.",
            },
            meetingJoinAttempts: {
                type: "integer",
                description: "Which join of the session made this recording: 0 for the first join, 1 for the first rejoin, ...",
            },
            fileName: { type: "string", nullable: true },
            storageKind: {
                type: "string",
                nullable: true,
                enum: ["local", "gateway"],
                description:
                    "Always gateway on anything stored now. local is a legacy row from before recordings went " +
                    "straight to the object store, and cannot be presigned or played.",
            },
            storageUrl: { type: "string", nullable: true },
            sizeBytes: { type: "integer", nullable: true },
            startedAt: { type: "string", format: "date-time", nullable: true },
            stoppedAt: { type: "string", format: "date-time", nullable: true },
            storedAt: { type: "string", format: "date-time", nullable: true },
            failureReason: { type: "string", nullable: true },
            signedUrl: {
                type: "string",
                nullable: true,
                description:
                    "Plays with no further credentials until it expires. Null for a recording held on local disk - use /v1/va/recordings/{recordingId}/file for those.",
            },
            expiresAt: { type: "string", format: "date-time", nullable: true },
        },
    },

    VirtualAvatarJoinCredentials: {
        type: "object",
        properties: {
            participantId: { type: "integer" },
            sessionReference: { type: "string" },
            displayName: { type: "string" },
            role: participantRole,
            acsRole: { type: "string", enum: ["Presenter", "Attendee", "Consumer"] },
            acsEndpoint: { type: "string" },
            roomId: { type: "string" },
            chatThreadId: { type: "string", nullable: true },
            communicationUserId: { type: "string" },
            acsToken: { type: "string" },
            acsTokenExpiresOn: { type: "string", format: "date-time" },
            roomValidUntil: { type: "string", format: "date-time" },
        },
    },

    /* -- requests -------------------------------------------------------- */

    EndVirtualAvatarSessionRequest: {
        type: "object",
        required: ["companyId"],
        properties: {
            companyId: { type: "integer", example: 7 },
            reason: { type: "string", maxLength: 50 },
        },
    },

    ExtendVirtualAvatarSessionRequest: {
        type: "object",
        required: ["companyId", "minutes"],
        properties: {
            companyId: { type: "integer", example: 7 },
            minutes: { type: "integer", minimum: 1, maximum: 480, example: 30 },
        },
    },

    RevokeVirtualAvatarLinksRequest: {
        type: "object",
        required: ["companyId"],
        properties: { companyId: { type: "integer", example: 7 } },
    },

    VirtualAvatarDecisionRequest: {
        type: "object",
        required: ["organiserRef", "decision"],
        properties: {
            companyId: { type: "integer", description: "Accepted, but the organiserRef is what proves authority." },
            organiserRef: { ...inviteToken, description: "The organiser's own invite token." },
            decision: { type: "string", enum: ["ADMIT", "DENY"] },
            reason: { type: "string", maxLength: 200 },
        },
    },

    VirtualAvatarTokenRequest: {
        type: "object",
        required: ["ref"],
        properties: { ref: inviteToken },
    },

    VirtualAvatarGuestRequest: {
        type: "object",
        required: ["ref", "email", "displayName"],
        properties: {
            ref: inviteToken,
            email: { type: "string", format: "email", maxLength: 255 },
            displayName: { type: "string", minLength: 1, maxLength: 150 },
        },
    },

    /* -- responses ------------------------------------------------------- */

    VirtualAvatarGuestResponse: flatEnvelope({
        guestRef: inviteToken,
        participantId: { type: "integer" },
        sessionReference: { type: "string" },
        displayName: { type: "string" },
        role: participantRole,
    }),

    VirtualAvatarSessionListResponse: envelope({
        meetings: { type: "array", items: { $ref: "#/components/schemas/VirtualAvatarSession" } },
        total: { type: "integer" },
    }),

    VirtualAvatarSessionResponse: dataOf({ $ref: "#/components/schemas/VirtualAvatarSession" }),

    VirtualAvatarLobbyResponse: listOf("waiting", "VirtualAvatarLobbyEntry"),

    VirtualAvatarDecisionResponse: envelope({
        participantId: { type: "integer" },
        decision: { type: "string", enum: ["ADMITTED", "DENIED"] },
    }),

    MeetingRecordingListResponse: listOf("recordings", "MeetingRecording"),

    MeetingRecordingLinkListResponse: envelope({
        sessionReference: { type: "string" },
        expiresIn: { type: "integer" },
        recordings: { type: "array", items: { $ref: "#/components/schemas/MeetingRecordingLink" } },
    }),

    MeetingRecordingLinkResponse: envelope({
        expiresIn: { type: "integer" },
        recording: { $ref: "#/components/schemas/MeetingRecordingLink" },
    }),

    
    Application: {
        type: "object",
        properties: {
            applicationUuid: { type: "string", format: "uuid" },
            sessionReference: { type: "string", nullable: true },
            applicationStatus: { type: "string", example: "SCHEDULED" },
            vaMeetingStatusId: {
                type: "integer",
                description: "Primary key of the tl_va_meeting_status row behind applicationStatus.",
            },
            applicationStatusLabel: {
                type: "string",
                example: "Interview Scheduled",
                description: "Client-facing wording for the system status; the override is not reflected here.",
            },
            overriddenApplicationStatus: { type: "string", nullable: true },
            aiRecommendationStatusId: { type: "integer", nullable: true },
            decisionHistory: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        updatedBy: { type: "integer" },
                        decisionStatusId: { type: "integer" },
                        decisionStatusLabel: { type: "string", example: "Passed" },
                        timestamp: { type: "string", format: "date-time" },
                    },
                },
            },
            registrationEmailRequested: { type: "boolean" },
            registrationEmailStatus: { type: "string", nullable: true, enum: ["LINK_SENT", "EMAIL_FAILED"] },
            effectiveStatus: {
                type: "string",
                description: "The override when there is one, otherwise the system status.",
            },
            candidateId: { type: "string", nullable: true },
            candidateName: { type: "string", nullable: true },
            candidateEmailMasked: { type: "string" },
            candidatePhoneNumber: { type: "string", nullable: true },
            jobShortCode: { type: "string", nullable: true },
            jobRoleLabel: { type: "string", nullable: true },
            jobLocation: { type: "string", nullable: true, description: "Not filled by anything yet." },
            interviewer: { type: "string", example: "AI" },
            applicationReceivedTs: { type: "string", format: "date-time", nullable: true },
            interviewScheduledTs: { type: "string", format: "date-time" },
            reviewerNotes: { type: "string", nullable: true },
            escalatedForStaff: { type: "boolean" },
            recordingId: { type: "integer", nullable: true },
            aiRecommendation: { type: "string", nullable: true, description: "Not filled by anything yet." },
            updatedUserId: { type: "integer", nullable: true },
            createdTs: { type: "string", format: "date-time" },
            updatedTs: { type: "string", format: "date-time", nullable: true },
        },
    },

    ApplicationListResponse: envelope({
        applications: { type: "array", items: { $ref: "#/components/schemas/Application" } },
        total: { type: "integer" },
    }),

    ApplicationResponse: envelope({ application: { $ref: "#/components/schemas/Application" } }),

    ReviewApplicationRequest: {
        type: "object",
        required: ["companyId"],
        properties: {
            companyId: { type: "integer" },
            reviewerNotes: { type: "string", nullable: true, maxLength: 10000 },
            overriddenApplicationStatus: { type: "string", nullable: true, example: "COMPLETED" },
            escalatedForStaff: { type: "boolean" },
            updatedUserId: {
                type: "integer",
                description: "Who made the change. Trusted, not verified - there is no login yet.",
            },
        },
    },

    ApplicationDecisionRequest: {
        type: "object",
        required: ["companyId", "aiRecommendationStatusId", "reviewerNotes"],
        properties: {
            companyId: { type: "integer" },
            aiRecommendationStatusId: {
                type: "integer",
                description: "ai_recommendation_status_id of an active tl_ai_recommendation_status row.",
            },
            reviewerNotes: { type: "string", nullable: true, maxLength: 10000 },
        },
    },

    RegistrationEmailRequest: {
        type: "object",
        required: ["companyId", "aiRecommendationStatusId", "registrationEmailRequested"],
        properties: {
            companyId: { type: "integer" },
            aiRecommendationStatusId: {
                type: "integer",
                description: "The decision status; the email is sent only when this is the Passed row.",
            },
            registrationEmailRequested: { type: "integer", enum: [0, 1], description: "1 asks for the email." },
        },
    },

    VaStatus: {
        type: "object",
        properties: {
            code: { type: "string", example: "ONGOING" },
            label: { type: "string", example: "Ongoing" },
            clientLabel: { type: "string", example: "Interview In Progress" },
            meetingStatus: {
                type: "string",
                nullable: true,
                example: "ACTIVE",
                description: "The meeting status a booking in this status sets, or null if it leaves the meeting alone.",
            },
            order: { type: "integer" },
        },
    },

    VaStatusListResponse: listOf("statuses", "VaStatus"),

    AiRecommendationStatus: {
        type: "object",
        properties: {
            code: { type: "string", example: "PASSED" },
            label: { type: "string", example: "Passed" },
            clientLabel: { type: "string", example: "Interview Passed" },
            order: { type: "integer" },
        },
    },

    AiRecommendationStatusListResponse: listOf("statuses", "AiRecommendationStatus"),

    VirtualAvatarPreflightResponse: flatEnvelope({
        sessionReference: { type: "string" },
        topic: { type: "string", nullable: true },
        sessionStatus: { type: "string", enum: ["ACTIVE", "ENDED", "EXPIRED", "REVOKED", "CANCELLED"] },
        joinable: { type: "boolean" },
        displayName: { type: "string" },
        role: participantRole,
        entersLobby: { type: "boolean" },
        seatsRemaining: { type: "integer" },
        expiresAt: { type: "string", format: "date-time" },
        recordingRequested: { type: "boolean" },
        requiresGuestDetails: { type: "boolean" },
    }),

    VirtualAvatarParticipantListResponse: flatListOf("participants", "VirtualAvatarInvite"),

    VirtualAvatarAttendee: {
        type: "object",
        properties: {
            participantId: { type: "integer" },
            name: { type: "string", description: "The display name, falling back to the email." },
            email: { type: "string" },
            role: { type: "string", enum: ["ORGANIZER", "CANDIDATE", "AGENT", "GUEST"] },
            candidateId: { type: "string", nullable: true },
            admissionState: {
                type: "string",
                enum: ["ADMITTED", "LEFT"],
                description: "Only these two reach an attendee - the rest never joined. LEFT once the meeting is over.",
            },
            joinedAt: { type: "string", format: "date-time" },
            leftAt: { type: "string", format: "date-time", nullable: true },
            stillInCall: { type: "boolean", description: "In the call right now. Always false once the meeting is over." },
            durationSeconds: {
                type: "integer",
                nullable: true,
                description: "leftAt minus joinedAt. Null while they are still in the call.",
            },
        },
    },

    VirtualAvatarAttendeeListResponse: envelope({
        sessionReference: { type: "string", format: "uuid" },
        meetingStatus: {
            type: "string",
            enum: ["SCHEDULED", "RESCHEDULED", "ACTIVE", "ENDED", "EXPIRED", "REVOKED", "CANCELLED"],
        },
        total: { type: "integer" },
        attendees: { type: "array", items: { $ref: "#/components/schemas/VirtualAvatarAttendee" } },
    }),

    VirtualAvatarHistoryEntry: {
        type: "object",
        properties: {
            step: { type: "integer", description: "Place in the meeting's order, 1 is the oldest. Stable across pages." },
            occurredAt: { type: "string", format: "date-time" },
            track: {
                type: "string",
                enum: [
                    "SCHEDULING",
                    "EMAIL_NOTIFICATION",
                    "MEETING_LIFECYCLE",
                    "PARTICIPANT_ADMISSION",
                    "AI_INTERVIEWER",
                    "AZURE_CALLING",
                    "MEETING_RECORDING",
                    "INTERVIEW_TOOL_CALL",
                    "TRANSCRIPT_CAPTURE",
                    "ESCALATION",
                    "RECRUITER_REVIEW",
                    "OTHER",
                ],
            },
            provider: { type: "string", enum: ["GRAPH", "SMTP", "ACS", "ANAM", "WORKABLE", "SYSTEM", "STAFF"] },
            eventType: { type: "string", example: "INVITE_EMAIL_SENT" },
            outcome: { type: "string", enum: ["OK", "SKIPPED", "RETRIED", "FAILED"] },
            fromStatus: { type: "string", nullable: true },
            toStatus: { type: "string", nullable: true },
            actorType: { type: "string", enum: ["SYSTEM", "PARTICIPANT", "STAFF", "PROVIDER"], nullable: true },
            actorId: { type: "integer", nullable: true },
            message: { type: "string", description: "One plain sentence, safe to show a client." },
            note: { type: "string", nullable: true },
            details: { type: "object", description: "Empty for a plain OK row. Redacted for the rest." },
            errorCode: { type: "string", nullable: true, description: "FAILED rows only." },
            errorMessage: { type: "string", nullable: true, description: "FAILED rows only. Raw, with emails and tokens masked." },
            open: {
                type: "boolean",
                nullable: true,
                description: "FAILED rows only. True while no later OK or RETRIED row exists for the same track and provider.",
            },
        },
    },

    VirtualAvatarHistoryResponse: envelope({
        sessionReference: { type: "string", format: "uuid" },
        finalStatus: {
            type: "string",
            nullable: true,
            description: "The schedule status the meeting last reached. Null when the meeting has no booking.",
        },
        summary: {
            type: "object",
            description: "Always the whole meeting, ignoring limit, offset and outcome.",
            properties: {
                total: { type: "integer" },
                failed: { type: "integer" },
                openFailures: { type: "integer" },
                failedTracks: { type: "array", items: { type: "string" } },
            },
        },
        total: { type: "integer", description: "Rows matching the outcome filter, before paging." },
        limit: { type: "integer" },
        offset: { type: "integer" },
        entries: { type: "array", items: { $ref: "#/components/schemas/VirtualAvatarHistoryEntry" } },
    }),

    VirtualAvatarMeetingTranscriptLine: {
        type: "object",
        properties: {
            lineId: { type: "integer" },
            participantId: { type: "integer", nullable: true },
            speakerName: { type: "string" },
            speakerRole: {
                type: "string",
                enum: ["ORGANIZER", "CANDIDATE", "AGENT", "GUEST"],
                nullable: true,
                description: "Null when the line could not be matched to a participant. AGENT is the AI interviewer.",
            },
            language: { type: "string", example: "en" },
            text: { type: "string" },
            translations: { type: "object", additionalProperties: { type: "string" } },
            at: { type: "string", format: "date-time" },
            offsetSeconds: { type: "integer", description: "Seconds after startedAt. Approximate against the recording." },
        },
    },

    VirtualAvatarMeetingTranscriptResponse: envelope({
        sessionReference: { type: "string", format: "uuid" },
        startedAt: { type: "string", format: "date-time", nullable: true },
        total: { type: "integer" },
        lines: { type: "array", items: { $ref: "#/components/schemas/VirtualAvatarMeetingTranscriptLine" } },
    }),

    VirtualAvatarSessionQuestion: {
        type: "object",
        properties: {
            key: { type: "string", example: "which-languages-do-you-interpret-between" },
            title: { type: "string", example: "Which languages do you interpret between" },
            kind: { type: "string", example: "question_answer" },
            order: { type: "integer", example: 1 },
            required: { type: "boolean" },
            question: { type: "string", description: "The wording the persona asks, placeholders filled.", example: "Hi Maria, which languages do you interpret between?" },
            context: { type: "string", nullable: true, description: "The direction given to the persona, not spoken." },
            captureFields: { type: "array", items: { type: "string" }, example: ["languages"] },
            ratingRequired: { type: "boolean", description: "Already resolved against the pattern." },
            recorded: {
                type: "object",
                nullable: true,
                description: "The latest answer recorded on this session's call, so a rejoined panel starts filled.",
                properties: {
                    choice: { type: "string", enum: ["yes", "no"], nullable: true },
                    answer: { type: "string", nullable: true },
                    score: { type: "integer", nullable: true },
                },
            },
        },
    },

    VirtualAvatarSessionQuestionSet: {
        type: "object",
        properties: {
            key: { type: "string", example: "42" },
            title: { type: "string", example: "Contact checklist" },
            questionPattern: { $ref: "#/components/schemas/QuestionPattern" },
            patternLabel: { type: "string", example: "Checklist" },
            patternOrder: { type: "integer", description: "The question type's own display order." },
            order: { type: "integer", description: "Where this set falls in the call." },
            ratingRequired: { type: "boolean" },
            questions: { type: "array", items: { $ref: "#/components/schemas/VirtualAvatarSessionQuestion" } },
        },
    },

    VirtualAvatarSessionQuestionsResponse: flatEnvelope({
        sessionReference: { type: "string" },
        scriptMode: { type: "string", enum: ["custom", "default"] },
        scriptTemplateId: { type: "integer", nullable: true, description: "The template pinned to this meeting. Null when none is." },
        scheduleStatus: { type: "string", nullable: true, example: "SCHEDULED" },
        jobShortCode: { type: "string", nullable: true },
        questionsTotal: { type: "integer" },
        sets: { type: "array", items: { $ref: "#/components/schemas/VirtualAvatarSessionQuestionSet" } },
    }),
    VirtualAvatarPublicLinkResponse: envelope({
        publicLink: { type: "string", example: "https://avatar.example.com/join?ref=3f9c1a7e5b2d4c8a9e0f1b2c3d4e5f60" },
    }),

    // An organiser or guest is admitted outright; an agent is parked in the lobby.
    VirtualAvatarJoinResponse: {
        allOf: [
            { $ref: "#/components/schemas/SuccessEnvelope" },
            {
                oneOf: [
                    {
                        allOf: [
                            { type: "object", properties: { state: { type: "string", enum: ["ADMITTED"] } } },
                            { $ref: "#/components/schemas/VirtualAvatarJoinCredentials" },
                        ],
                    },
                    {
                        type: "object",
                        properties: {
                            state: { type: "string", enum: ["PENDING"] },
                            participantId: { type: "integer" },
                            sessionReference: { type: "string" },
                            displayName: { type: "string" },
                            role: participantRole,
                        },
                    },
                ],
            },
        ],
    },

    VirtualAvatarCredentialsResponse: {
        allOf: [
            { $ref: "#/components/schemas/SuccessEnvelope" },
            { $ref: "#/components/schemas/VirtualAvatarJoinCredentials" },
        ],
    },

    VirtualAvatarPersonaTokenResponse: flatEnvelope({
        sessionToken: { type: "string", description: "Short-lived. The Anam API key never leaves this service." },
        personaName: { type: "string", description: "The drawn avatar's display name." },
        scriptMode: {
            type: "string",
            enum: ["custom", "default", "conversation"],
            description:
                "Which script the persona was given. 'conversation' means no interview script resolved for the company at all.",
        },
        jobShortCode: {
            type: "string",
            nullable: true,
            description: "The candidate's job code that selected the script. Null when no candidate or no code was found.",
        },
        toolNames: {
            type: "array",
            items: { type: "string" },
            description:
                "The company-prefixed names of the tools this session attached. The browser registers handlers for the CLIENT ones.",
        },
    }),

    VirtualAvatarAgentHandoffResponse: flatEnvelope({
        agentRef: {
            ...inviteToken,
            nullable: true,
            description: "The agent's invite token. Only returned to the one tab that is to host it.",
        },
        outcome: {
            type: "string",
            enum: ["HOSTING", "ALREADY_IN", "NO_AGENT", "DENIED"],
            description: "HOSTING: send the persona in. The others say why not.",
        },
    }),

    VirtualAvatarTranscriptLine: {
        type: "object",
        properties: {
            lineId: { type: "integer" },
            participantId: { type: "integer", nullable: true },
            speakerName: { type: "string" },
            language: { type: "string", example: "en" },
            text: { type: "string" },
            translations: {
                type: "object",
                additionalProperties: { type: "string" },
                example: { es: "Hola" },
            },
            at: { type: "string", format: "date-time" },
        },
    },

    VirtualAvatarTranscriptionState: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["ACTIVE", "PAUSED", "STOPPED", "FAILED"], nullable: true },
            language: { type: "string", example: "en" },
        },
    },

    VirtualAvatarTranscriptResponse: flatEnvelope({
        transcription: { $ref: "#/components/schemas/VirtualAvatarTranscriptionState" },
        listenerLanguage: { type: "string", nullable: true },
        languages: {
            type: "array",
            items: {
                type: "object",
                properties: { code: { type: "string" }, label: { type: "string" } },
            },
        },
        lines: { type: "array", items: { $ref: "#/components/schemas/VirtualAvatarTranscriptLine" } },
    }),

    VirtualAvatarTranscriptionResponse: flatEnvelope({
        transcription: { $ref: "#/components/schemas/VirtualAvatarTranscriptionState" },
    }),

    EventGridValidationResponse: {
        type: "object",
        properties: { validationResponse: { type: "string" } },
    },
};

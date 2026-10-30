import { dataOf, envelope, listOf } from "./commonSchema";
import { HIRE_RECOMMENDATIONS } from "../constants/interview/interview.tools";

const interviewReference = {
    type: "string",
    minLength: 3,
    maxLength: 30,
    description: "The call this tool belongs to. Anam passes back what the opening gave it.",
    example: "INT-7-42-3",
};

export const interviewSchemas = {
    Persona: {
        type: "object",
        properties: {
            key: { type: "string", example: "interviewer" },
            role: { type: "string", example: "Vendor onboarding interviewer" },
            kind: { $ref: "#/components/schemas/ProgramKind" },
            programKey: { type: "string", example: "vendor-interview" },
            companyId: { type: "integer", example: 7 },
            companyName: { type: "string", example: "Baystate Interpreters" },
            presetStyles: { type: "array", items: { type: "string" } },
            defaultPresetStyle: { type: "string", nullable: true },
            defaultExpressivity: { type: "number", nullable: true },
        },
    },

    VendorListItem: {
        type: "object",
        properties: {
            id: { type: "integer", example: 42 },
            name: { type: "string", example: "Maria Alvarez" },
            languages: { type: "array", items: { type: "string" }, example: ["Spanish", "Portuguese"] },
            answered: { type: "integer", example: 6 },
            total: { type: "integer", description: "Required questions only.", example: 11 },
            interviewStatus: {
                type: "string",
                enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"],
            },
            reference: { type: "string", nullable: true, example: "INT-7-42-3" },
        },
    },

    InterviewAnswer: {
        type: "object",
        properties: {
            questionKey: { type: "string", example: "which-languages-do-you-interpret-between" },
            type: { type: "string", example: "QUESTION_ANSWER" },
            outcome: { type: "string", enum: ["answered", "skipped", "declined", "unclear"] },
            summary: { type: "string", nullable: true },
            score: { type: "number", nullable: true, description: "One to five. Null on an unscored pattern." },
        },
    },

    VendorDetail: {
        type: "object",
        properties: {
            id: { type: "integer", example: 42 },
            name: { type: "string", example: "Maria Alvarez" },
            vendorCode: { type: "string", nullable: true },
            emailMasked: { type: "string", nullable: true, example: "m***@example.com" },
            phoneMasked: { type: "string", nullable: true, example: "***-***-4417" },
            details: { type: "object", additionalProperties: true },
            interviewStatus: { type: "string", example: "IN_PROGRESS" },
            interview: {
                type: "object",
                nullable: true,
                properties: {
                    reference: { type: "string", example: "INT-7-42-3" },
                    status: { type: "string", example: "IN_PROGRESS" },
                    attemptNo: { type: "integer", example: 1 },
                    averageScore: { type: "number", nullable: true },
                    escalations: { type: "array", items: { type: "object", additionalProperties: true } },
                    total: { type: "integer" },
                    answers: { type: "array", items: { $ref: "#/components/schemas/InterviewAnswer" } },
                },
            },
        },
    },

    ChecklistQuestion: {
        type: "object",
        properties: {
            key: { type: "string" },
            title: { type: "string" },
            kind: { type: "string" },
            required: { type: "boolean" },
            order: { type: "integer" },
            captureFields: { type: "array", items: { type: "string" } },
            ratingRequired: { type: "boolean" },
            answer: { type: "object", nullable: true, additionalProperties: true },
        },
    },

    ProgramChecklist: {
        type: "object",
        properties: {
            key: { type: "string", example: "contact-checklist" },
            title: { type: "string", example: "Contact checklist" },
            kind: { $ref: "#/components/schemas/QuestionPattern" },
            order: { type: "integer" },
            ratingRequired: { type: "boolean" },
            jobId: { type: "integer", nullable: true },
            jobLabel: { type: "string", nullable: true },
            questions: { type: "array", items: { $ref: "#/components/schemas/ChecklistQuestion" } },
        },
    },

    InterviewToolState: {
        type: "object",
        properties: {
            key: { type: "string", example: "record_answer" },
            kind: { type: "string", example: "webhook" },
            name: { type: "string", description: "The prefixed name Anam holds.", example: "baystate_record_answer" },
            provisioned: { type: "boolean" },
            detail: { type: "string", example: "/v1/interview/tools/record-answer" },
        },
    },

    GetPersonasResponse: listOf("personas", "Persona"),
    GetVendorsResponse: listOf("vendors", "VendorListItem"),
    GetVendorResponse: dataOf({ $ref: "#/components/schemas/VendorDetail" }),
    GetProgramResponse: envelope({
        checklists: { type: "array", items: { $ref: "#/components/schemas/ProgramChecklist" } },
        mode: { type: "string", enum: ["custom", "default"] },
        scriptTemplateId: { type: "integer", nullable: true },
        meetingStatus: { type: "string", nullable: true },
    }),

    CallEscalation: {
        type: "object",
        properties: {
            question: { type: "string", example: "What is the privacy policy?" },
            questionKey: { type: "string", nullable: true, example: "faq:1" },
            suggestedOwner: {
                type: "string",
                enum: ["payroll", "compliance", "scheduling", "IT support", "vendor management"],
            },
            raisedTs: { type: "string", format: "date-time" },
        },
    },

    CallAnswer: {
        type: "object",
        properties: {
            questionKey: { type: "string", example: "which-languages-do-you-interpret-between" },
            questionPattern: {
                type: "string",
                nullable: true,
                enum: ["CHECKLIST", "QUESTION_ANSWER", "SCENARIO", "GREETING", "INTERVIEW_CONCLUSION"],
            },
            answer: {
                type: "object",
                properties: {
                    body: { type: "string", description: "The persona's summary. Empty while the question is still only asked.", example: "Spanish, French, Haitian Creole" },
                    rawResponse: {
                        type: "string",
                        nullable: true,
                        description: "Their words verbatim. Null while unanswered, or on an entry recorded before the verbatim was captured.",
                        example: "Uh, so Spanish and French mainly, and - and Haitian Creole, I do that one too but less often",
                    },
                },
            },
            outcome: { type: "string", nullable: true, enum: ["asked", "answered", "skipped", "declined", "unclear", "match", "mismatch", "missing"] },
            score: { type: "number", nullable: true, description: "One to five. Null on an unscored pattern." },
            askedTs: {
                type: "string",
                format: "date-time",
                nullable: true,
                description:
                    "When the question was put to them. Falls back to the recorded time on an entry that " +
                    "was never asked - a candidate's own question, or a lifecycle event.",
            },
        },
    },

    GetCallAnswersResponse: envelope({
        sessionReference: { type: "string", example: "9f6b2c41-0d7e-4a55-b3c2-7a1f0e8d4b19" },
        callId: { type: "integer", description: "The attempt the sheet came from - the session's latest.", example: 19 },
        reference: { type: "string", example: "INT-427149" },
        escalations: {
            type: "array",
            description: "Questions nobody could answer, for a person to follow up.",
            items: { $ref: "#/components/schemas/CallEscalation" },
        },
        answers: {
            type: "object",
            description:
                "Keyed on question.body, strictly in the order things happened, rejoins included. Consecutive " +
                "entries for the same question share one key; a question that comes up again later gets its own " +
                "key with \" (2)\", \" (3)\" and so on.",
            additionalProperties: { type: "array", items: { $ref: "#/components/schemas/CallAnswer" } },
            example: {
                "Which languages do you interpret between, and which direction are you strongest in?": [
                    {
                        questionKey: "which-languages-do-you-interpret-between",
                        questionPattern: "QUESTION_ANSWER",
                        answer: {
                            body: "Spanish, French, Haitian Creole",
                            rawResponse: "Uh, so Spanish and French mainly, and - and Haitian Creole, I do that one too but less often",
                        },
                        outcome: "answered",
                        score: 4,
                        askedTs: "2026-09-17T10:04:11.402Z",
                    },
                ],
            },
        },
    }),

    SessionEscalation: {
        type: "object",
        properties: {
            question: { type: "string", example: "Do you reimburse parking at the downtown hospital?" },
            questionKey: { type: "string", nullable: true, description: "The question it came up inside, if any." },
            suggestedOwner: { type: "string", example: "the scheduling team" },
            raisedTs: { type: "string", format: "date-time" },
            callId: { type: "integer", example: 19 },
            reference: { type: "string", example: "INT-427149" },
            attemptNo: { type: "integer", example: 1 },
        },
    },

    GetSessionEscalationsResponse: envelope({
        sessionReference: { type: "string", example: "9f6b2c41-0d7e-4a55-b3c2-7a1f0e8d4b19" },
        total: { type: "integer", example: 1 },
        escalations: { type: "array", items: { $ref: "#/components/schemas/SessionEscalation" } },
    }),

    EvaluationBand: {
        type: "object",
        properties: {
            key: {
                type: "string",
                enum: [
                    "languageProficiency",
                    "scenarioResponse",
                    "culturalCompetence",
                    "professionalism",
                    "communicationSkills",
                ],
            },
            label: { type: "string", example: "Language proficiency" },
            score: { type: "number", nullable: true, description: "One to five. Null where the persona sent nothing usable.", example: 4 },
            verdict: {
                type: "string",
                nullable: true,
                enum: ["exceeds", "meets", "partially meets", "below", "well below"],
            },
            basis: {
                type: "string",
                nullable: true,
                description:
                    "The persona's own reasoning for this score - what on the call earned it and what held it " +
                    "back. Null where the persona sent none, and on every call submitted before this field existed.",
                example: "Switched cleanly between English and Spanish and kept grammar accurate, but hesitated on medical terms.",
            },
        },
    },

    GetSessionEvaluationResponse: envelope({
        sessionId: { type: "integer", description: "Resolved from the reference, whichever half was sent.", example: 31 },
        sessionUid: { type: "string", example: "9f6b2c41-0d7e-4a55-b3c2-7a1f0e8d4b19" },
        callId: { type: "integer", description: "The attempt the rating came from - the session's latest.", example: 19 },
        reference: { type: "string", example: "INT-427149" },
        submittedAt: { type: "string", format: "date-time", nullable: true, description: "Null on a call that never submitted." },
        averageScore: {
            type: "number",
            nullable: true,
            description: "The mean of the per-question scores, not of the bands below.",
            example: 4.4,
        },
        recommendation: {
            type: "string",
            nullable: true,
            enum: [...HIRE_RECOMMENDATIONS],
            description: "The persona's hiring recommendation. Null on a call that never submitted, or sent none.",
            example: "hire",
        },
        summary: {
            type: "string",
            nullable: true,
            description: "The persona's own prose on how they did. Null on a call that never submitted.",
            example:
                "The candidate showed strong English to Spanish proficiency and clear everyday use of both " +
                "languages. They are not certified but gave candid answers about their experience.",
        },
        bands: {
            type: "array",
            description: "All five bands, always, in rubric order - an unrated band comes back null rather than missing.",
            items: { $ref: "#/components/schemas/EvaluationBand" },
        },
    }),

    GetProgramScriptResponse: envelope({
        script: { type: "string", description: "The full assembled prompt text - every question, context, expected answer and outcome phrasing, in speaking order." },
        mode: { type: "string", enum: ["custom", "default"] },
        scriptTemplateId: { type: "integer", nullable: true },
        meetingStatus: { type: "string", nullable: true },
    }),

    GetInterviewConfigResponse: envelope({
        ready: { type: "boolean", description: "Credentials present and every tool provisioned." },
        missing: { type: "array", items: { type: "string" }, description: "Anam settings still unset." },
        provisioned: { type: "boolean" },
        company: { $ref: "#/components/schemas/Company" },
        personaKey: { type: "string" },
        personaRole: { type: "string" },
        personaKind: { $ref: "#/components/schemas/ProgramKind" },
        presetStyles: { type: "array", items: { type: "string" } },
        directorNotes: { type: "object", additionalProperties: true },
        publicBaseUrl: { type: "string", description: "Must reach this service or the persona goes quiet." },
        knowledge: {
            type: "object",
            properties: {
                source: { type: "string", example: "local" },
                files: { type: "array", items: { type: "string" } },
                chunks: { type: "integer" },
            },
        },
        tools: { type: "array", items: { $ref: "#/components/schemas/InterviewToolState" } },
        systemPrompt: { type: "string", description: "Withheld in production." },
    }),

    /* -- the seven webhook tools ----------------------------------------- */

    AskQuestionRequest: {
        type: "object",
        required: ["interviewReference"],
        properties: {
            interviewReference,
            questionKey: {
                type: "string",
                maxLength: 50,
                example: "which-languages-do-you-interpret-between",
                description: "Omit to be handed the next question still uncovered.",
            },
        },
    },

    VerifyContactRequest: {
        type: "object",
        required: ["interviewReference", "field", "statedValue"],
        properties: {
            interviewReference,
            field: { type: "string", enum: ["email", "phone"] },
            statedValue: { type: "string", maxLength: 320, example: "maria.alvarez@example.com" },
        },
    },

    RecordAnswerRequest: {
        type: "object",
        required: ["interviewReference", "questionKey"],
        properties: {
            interviewReference,
            questionKey: { type: "string", maxLength: 50, example: "which-languages-do-you-interpret-between" },
            summary: { type: "string", maxLength: 4000, default: "" },
            rawResponse: { type: "string", maxLength: 8000, default: "", description: "Their answer verbatim, not summarised." },
            data: { type: "object", additionalProperties: true, description: "The question's captureFields." },
            outcome: { type: "string", enum: ["answered", "skipped", "declined", "unclear"] },
            score: { oneOf: [{ type: "string" }, { type: "number" }], description: "One to five on a scored pattern." },
        },
    },

    RecordChecklistRequest: {
        type: "object",
        required: ["interviewReference", "questionKey", "outcome"],
        properties: {
            interviewReference,
            questionKey: { type: "string", maxLength: 50, example: "email-checklist" },
            outcome: { type: "string", enum: ["yes", "no"] },
            summary: { type: "string", maxLength: 4000, description: "What they actually said, if it adds anything beyond yes or no." },
            rawResponse: { type: "string", maxLength: 8000, default: "", description: "Their reply verbatim, not summarised." },
        },
    },

    RecordCandidateQuestionRequest: {
        type: "object",
        required: ["interviewReference", "question", "found"],
        properties: {
            interviewReference,
            question: { type: "string", minLength: 2, maxLength: 1000, example: "What is the privacy policy?" },
            found: {
                type: "string",
                enum: ["true", "false"],
                description: "Whether the search actually answered them. false raises a follow-up.",
            },
            answer: { type: "string", maxLength: 4000, description: "What they were told. Omitted on a miss." },
        },
    },

    FlagForStaffRequest: {
        type: "object",
        required: ["interviewReference", "question"],
        properties: {
            interviewReference,
            question: { type: "string", minLength: 2, maxLength: 1000 },
            context: { type: "string", maxLength: 2000 },
            questionKey: { type: "string", maxLength: 50 },
        },
    },

    SubmitInterviewRequest: {
        type: "object",
        required: ["interviewReference"],
        properties: {
            interviewReference,
            closingNote: { type: "string", maxLength: 2000 },
            languageProficiency: { type: "string", description: "One to five. Anything outside that is stored as null." },
            scenarioResponse: { type: "string", description: "One to five. Anything outside that is stored as null." },
            culturalCompetence: { type: "string", description: "One to five. Anything outside that is stored as null." },
            professionalism: { type: "string", description: "One to five. Anything outside that is stored as null." },
            communicationSkills: { type: "string", description: "One to five. Anything outside that is stored as null." },
            recommendation: { type: "string", enum: [...HIRE_RECOMMENDATIONS], description: "Anything else is stored as null." },
            evaluationSummary: { type: "string", maxLength: 2000 },
        },
    },

    // No EndCallRequest: end_call is Anam's SYSTEM tool now and has no request
    // body to document - it never reaches this service.

    // Not the standard envelope: a tool answers 200 with a line to speak, because
    // a 500 mid-call leaves the persona silent.
    ToolResponse: {
        type: "object",
        properties: {
            ok: { type: "boolean", example: true },
            say: { type: "string", description: "Spoken verbatim. Empty means say nothing." },
            error: { type: "boolean", description: "Present instead of ok when the tool failed." },
            message: { type: "string", description: "The fallback line, on failure." },
            suggestion: { type: "string", example: "Move on with the call and do not mention this." },
        },
    },
};

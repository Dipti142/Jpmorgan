import { envelope, listOf } from "./commonSchema";

// Referenced rather than repeated - the codes were hand-copied in four places.
const questionPattern = { $ref: "#/components/schemas/QuestionPattern" };

const programKind = { $ref: "#/components/schemas/ProgramKind" };

const scriptSetIds = {
    type: "array",
    maxItems: 20,
    items: { type: "integer" },
    description: "The sets under this heading. Array order is the speaking order.",
    example: [21, 30, 45],
};

export const customScriptSchemas = {
    QuestionPattern: {
        type: "string",
        enum: ["GREETING", "CHECKLIST", "QUESTION_ANSWER", "SCENARIO", "INTERVIEW_CONCLUSION"],
        description:
            "GREETING and INTERVIEW_CONCLUSION are spoken, not asked - unscored, not required, no tool. " +
            "CHECKLIST is yes/no and unscored; QUESTION_ANSWER and SCENARIO are open answers scored one to five.",
    },

    ProgramKind: { type: "string", enum: ["INTERVIEW", "ORIENTATION"] },

    ScriptQuestion: {
        type: "object",
        description:
            "Only `question` is required. key, title, kind, order, captureFields and tool are not sent here at " +
            "all - they are plumbing derived server-side from questionPattern and the array position, not " +
            "editorial content an author needs to know about.",
        required: ["question"],
        properties: {
            question: {
                type: "string",
                maxLength: 4000,
                example: "Which languages do you interpret between, and which direction are you strongest in?",
            },
            expectedAnswer: {
                type: "string",
                maxLength: 4000,
                description: "What a good answer covers. Never returned by a listing.",
            },
            required: {
                type: "boolean",
                default: true,
                description: "An uncovered required question blocks submit. Defaults to false on GREETING.",
            },
            context: { type: "string", maxLength: 4000, description: "The direction behind the line. Never spoken." },
            evaluationGuidance: { type: "string", maxLength: 4000 },
            ratingRequired: {
                type: "boolean",
                description:
                    "Omit to inherit the pattern - only QUESTION_ANSWER and SCENARIO are scored by default.",
            },
            expected_responses: {
                type: "object",
                additionalProperties: { type: "string" },
                description: 'Outcome to say-this-next, rendered as "If <outcome>: ...".',
                example: { vague: "Ask once more, then move on.", declined: "Record it and move on." },
            },
            isActive: { type: "boolean", default: true },
        },
    },

    ScriptSet: {
        type: "object",
        description: "One question set of one pattern. The reusable piece.",
        properties: {
            scriptId: { type: "integer", example: 21 },
            questionPattern,
            scriptName: { type: "string", example: "Contact checklist" },
            questionCount: { type: "integer" },
            isActive: { type: "boolean" },
            createdTs: { type: "string", format: "date-time" },
        },
    },

    ScriptSetDetail: {
        allOf: [
            { $ref: "#/components/schemas/ScriptSet" },
            {
                type: "object",
                properties: {
                    questions: { type: "array", items: { $ref: "#/components/schemas/ScriptQuestion" } },
                },
            },
        ],
    },

    ScriptTemplate: {
        type: "object",
        description: "The heading. Gathers one set of each pattern under one name, and carries the uuid a job role is pointed at.",
        properties: {
            scriptUuid: {
                type: "string",
                format: "uuid",
                description: "The handle. Quote this to assign, read or revise the heading.",
                example: "8f2b1c44-5d6e-4a71-9c3f-0b7d2e5a1f90",
            },
            templateKey: { type: "string", example: "onsite-interpreter-interview" },
            templateName: { type: "string", example: "Onsite interpreter interview" },
            templateDescription: { type: "string", nullable: true },
            programKind,
            scriptSetIds,
            setCount: { type: "integer" },
            isActive: { type: "boolean" },
            createdTs: { type: "string", format: "date-time" },
        },
    },

    QuestionPatternDetail: {
        type: "object",
        description: "One pattern row, as the createScriptSet catalogue lists it.",
        properties: {
            patternCode: questionPattern,
            patternLabel: { type: "string", example: "Question & answer" },
            questionKind: { type: "string", example: "question_answer" },
            ratingRequiredDefault: {
                type: "boolean",
                description: "What ratingRequired defaults to on a question of this pattern when left out.",
            },
            displayOrder: { type: "integer" },
        },
    },

    DefaultScriptSet: {
        type: "object",
        description: "One seeded default set, questions included - what scriptBuilder falls back to.",
        properties: {
            defaultScriptId: { type: "integer" },
            questionPattern,
            participantRole: { type: "string", enum: ["ORGANISER", "AGENT"] },
            scriptType: { type: "string", enum: ["DEFAULT", "OPTIONAL"] },
            scriptKey: { type: "string", example: "contact-checklist" },
            scriptName: { type: "string", example: "Contact checklist" },
            scriptOrder: { type: "integer", description: "The speaking order." },
            isActive: { type: "boolean" },
            questions: { type: "array", items: { $ref: "#/components/schemas/ScriptQuestion" } },
            createdTs: { type: "string", format: "date-time" },
        },
    },

    RoleScript: {
        type: "object",
        description: "One job role, and the heading it runs.",
        properties: {
            customScriptId: { type: "integer" },
            jobShortCode: { type: "string", example: "1973be" },
            jobLabel: { type: "string", nullable: true, example: "Onsite Interpretation" },
            programKind,
            participantRole: { type: "string", enum: ["ORGANISER", "AGENT"] },
            scriptUuid: { type: "string", format: "uuid" },
            templateName: { type: "string", example: "Onsite interpreter interview" },
        },
    },

    CreateScriptSetRequest: {
        type: "object",
        required: ["companyId", "questionPattern", "scriptName", "questions"],
        properties: {
            companyId: { type: "integer", example: 7 },
            scriptId: {
                type: "integer",
                nullable: true,
                description:
                    "Revises that set in place instead of writing a new one. Refused with 409 if any heading " +
                    "already gathers it - correct it through POST /v1/scripts/update instead. Left out or null creates.",
                example: 21,
            },
            questionPattern,
            scriptName: { type: "string", maxLength: 150, example: "Contact checklist" },
            questions: {
                type: "array",
                minItems: 1,
                maxItems: 100,
                items: { $ref: "#/components/schemas/ScriptQuestion" },
            },
        },
    },

    CreateScriptTemplateRequest: {
        type: "object",
        required: ["templateName", "scriptSetIds"],
        properties: {
            programKind: {
                allOf: [programKind],
                default: "INTERVIEW",
                description: "Copied onto every assignment made from this heading, so the two can never disagree.",
            },
            templateKey: {
                type: "string",
                maxLength: 50,
                description: "Unique per company. Derived from templateName when omitted.",
                example: "onsite-interpreter-interview",
            },
            templateName: { type: "string", maxLength: 150, example: "Onsite interpreter interview" },
            templateDescription: { type: "string", maxLength: 4000, description: "Never spoken to the candidate." },
            scriptSetIds: { ...scriptSetIds, description: "May be empty while the heading is drafted." },
        },
    },

    UpdateScriptTemplateRequest: {
        type: "object",
        required: ["companyId"],
        description: "Only the fields you send are touched.",
        properties: {
            companyId: { type: "integer", example: 7 },
            templateName: { type: "string", maxLength: 150 },
            templateDescription: { type: "string", maxLength: 4000, nullable: true },
            scriptSetIds: { ...scriptSetIds, description: "Replaces the list outright. Send the whole thing, in order." },
            acknowledgeImpact: {
                type: "boolean",
                default: false,
                description:
                    "Confirms you have read which job roles this heading serves. Needed only when scriptSetIds changes and roles are assigned. Never overrides the in-progress-interview refusal.",
            },
            isActive: {
                type: "boolean",
                description: "false retires the heading. Roles already pointing at it keep running until reassigned.",
            },
        },
    },

    UpdateCustomScriptRequest: {
        type: "object",
        required: ["scriptId", "scriptUuid", "questionPattern", "scriptName", "questions"],
        description:
            "companyId is not sent here - it is read off the caller's verified JWT. " +
            "A free-standing set (one no heading gathers yet) is POST /scripts's to rewrite, by " +
            "sending its scriptId there - this endpoint only replaces a set already gathered by scriptUuid's heading, " +
            "retiring both old rows and moving any assigned role across.",
        properties: {
            scriptId: { type: "integer", description: "The set being corrected.", example: 21 },
            scriptUuid: {
                type: "string",
                format: "uuid",
                description: "The heading currently gathering scriptId.",
                example: "8f2b1c44-5d6e-4a71-9c3f-0b7d2e5a1f90",
            },
            questionPattern,
            scriptName: { type: "string", maxLength: 150, example: "Contact checklist" },
            questions: {
                type: "array",
                minItems: 1,
                maxItems: 100,
                items: { $ref: "#/components/schemas/ScriptQuestion" },
            },
        },
    },

    UpdateCustomScriptResponse: envelope({
        script: { $ref: "#/components/schemas/ScriptSetDetail" },
        previousScriptId: { type: "integer", description: "The set that was retired." },
        previousScriptUuid: { type: "string", format: "uuid", description: "The heading that was retired." },
        scriptUuid: { type: "string", format: "uuid", description: "The new heading's handle." },
        reassignedRoles: {
            type: "array",
            items: { $ref: "#/components/schemas/RoleScript" },
            description: "Job roles moved from the retired heading to the new one.",
        },
    }),

    AssignScriptRequest: {
        type: "object",
        required: ["companyId", "scriptUuid", "jobRoles"],
        properties: {
            companyId: { type: "integer", example: 7 },
            scriptUuid: {
                type: "string",
                format: "uuid",
                example: "8f2b1c44-5d6e-4a71-9c3f-0b7d2e5a1f90",
            },
            participantRole: { type: "string", enum: ["ORGANISER", "AGENT"], default: "AGENT" },
            jobRoles: {
                type: "array",
                minItems: 1,
                maxItems: 200,
                description: "Bulk assign - fifty job codes, one heading.",
                items: {
                    type: "object",
                    required: ["jobShortCode"],
                    properties: {
                        jobShortCode: { type: "string", maxLength: 50, example: "1973be" },
                        jobLabel: { type: "string", maxLength: 150, example: "Onsite Interpretation" },
                    },
                },
            },
            assign: {
                type: "integer",
                enum: [0, 1],
                default: 1,
                description:
                    "0 checks whether any listed job role already has a script and refuses with 409 " +
                    "naming it, without writing anything. 1 (default) writes through, replacing any " +
                    "existing assignment - the only behavior before this flag existed.",
            },
            remove: {
                type: "integer",
                enum: [0, 1],
                default: 0,
                description: "1 unassigns the listed job role(s), dropping them back to the default script.",
            },
        },
    },

    ScriptSetDetailResponse: envelope({ script: { $ref: "#/components/schemas/ScriptSetDetail" } }),
    ScriptSetListResponse: listOf("scripts", "ScriptSet"),
    ScriptTemplateResponse: envelope({ template: { $ref: "#/components/schemas/ScriptTemplate" } }),
    ScriptTemplateListResponse: listOf("templates", "ScriptTemplate"),
    AssignScriptResponse: listOf("assigned", "RoleScript"),
    AssignmentListResponse: listOf("assignments", "RoleScript"),
    QuestionPatternListResponse: listOf("patterns", "QuestionPatternDetail"),
    DefaultScriptListResponse: listOf("sets", "DefaultScriptSet"),
};

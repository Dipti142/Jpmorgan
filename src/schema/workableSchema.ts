import { envelope } from "./commonSchema";

export const workableSchemas = {
    WorkableJob: {
        type: "object",
        properties: {
            id: { type: "string" },
            shortcode: { type: "string", example: "F63E3DA83E" },
            title: { type: "string", example: "In-person Interpreter (All languages)" },
            fullTitle: { type: "string", nullable: true },
            state: { type: "string", enum: ["draft", "published", "archived", "closed"] },
            department: { type: "string", nullable: true },
            location: { type: "string", nullable: true },
            workplaceType: { type: "string", nullable: true },
            url: { type: "string", nullable: true },
            applicationUrl: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time", nullable: true },
            activeTemplate: {
                type: "object",
                nullable: true,
                description: "The heading currently assigned to this job's shortcode, or null if none is.",
                properties: {
                    scriptUuid: { type: "string", format: "uuid" },
                    templateName: { type: "string", example: "Onsite interpreter interview" },
                },
            },
        },
    },

    WorkableJobListResponse: envelope({
        total: { type: "integer", description: "All jobs in this state, before paging." },
        limit: { type: "integer" },
        offset: { type: "integer" },
        jobs: { type: "array", items: { $ref: "#/components/schemas/WorkableJob" } },
    }),

    WorkableCandidate: {
        type: "object",
        description: "Workable sends a great deal more per delivery; what is not listed here is not stored.",
        required: ["id"],
        properties: {
            id: { type: "string", example: "1a2b3c4d" },
            name: { type: "string", nullable: true },
            firstname: { type: "string", nullable: true },
            lastname: { type: "string", nullable: true },
            headline: { type: "string", nullable: true },
            job: {
                type: "object",
                nullable: true,
                properties: {
                    shortcode: { type: "string", nullable: true, example: "1973be" },
                    title: { type: "string", nullable: true, example: "Onsite Interpretation" },
                },
            },
            stage: { type: "string", nullable: true },
            stage_kind: { type: "string", nullable: true },
            disqualified: { type: "boolean", nullable: true },
            disqualified_at: { type: "string", nullable: true },
            disqualification_reason: { type: "string", nullable: true },
            profile_url: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
            phone: { type: "string", nullable: true },
            email: { type: "string", nullable: true },
            common_source: { type: "string", nullable: true },
            // Kept whole rather than flattened: the shape varies by question type.
            answers: { type: "array", nullable: true, items: { type: "object", additionalProperties: true } },
            created_at: { type: "string", nullable: true },
            updated_at: { type: "string", nullable: true },
            resume_url: { type: "string", nullable: true },
        },
    },

    WorkableWebhook: {
        type: "object",
        required: ["event_type", "id", "data"],
        properties: {
            event_type: { type: "string", example: "candidate_created" },
            id: { type: "string" },
            fired_at: { type: "string", format: "date-time" },
            resource_type: { type: "string", example: "candidate" },
            data: { $ref: "#/components/schemas/WorkableCandidate" },
        },
    },

    // Not the standard envelope - these handlers answer Workable directly.
    WorkableAck: {
        type: "object",
        properties: { message: { type: "string", example: "Webhook received" } },
    },
};

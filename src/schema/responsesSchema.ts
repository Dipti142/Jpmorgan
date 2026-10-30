// Error bodies differ only in the message, so the body is built once.
const failure = (example: string) => ({
    type: "object",
    properties: {
        status: { type: "string", example: "failed" },
        success: { type: "boolean", example: false },
        message: { type: "string", example },
    },
});

const json = (description: string, schema: Record<string, unknown>) => ({
    description,
    content: { "application/json": { schema } },
});

export const responsesSchema = {
    BadRequest: json("Bad request", failure("Invalid request")),

    Unauthorized: json("Missing or wrong X-Tool-Secret on a /tools call", failure("Unauthorized")),

    // validationError answers 403, not 422, and adds a field-keyed errors map.
    ValidationError: json("Validation failed", {
        type: "object",
        properties: {
            status: { type: "string", example: "failed" },
            success: { type: "boolean", example: false },
            errors: {
                type: "object",
                additionalProperties: { type: "string" },
                example: { companyId: "Expected number, received nan" },
            },
            message: { type: "string", example: "form validation errors" },
        },
    }),

    NotFound: json("No such record for this company", failure("No vendor 42 for company 7")),

    Conflict: json("The request contradicts what is already stored", failure("Conflict: script key already exists")),

    ServerError: json("Internal server error", failure("Internal Server Error")),
};

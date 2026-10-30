export const commonSchemas = {
    SuccessEnvelope: {
        type: "object",
        properties: {
            status: { type: "string", example: "success" },
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Success" },
        },
    },
};

export const envelope = (properties: Record<string, unknown>) => ({
    allOf: [
        { $ref: "#/components/schemas/SuccessEnvelope" },
        { type: "object", properties: { data: { type: "object", properties } } },
    ],
});

export const dataOf = (schema: Record<string, unknown>) => ({
    allOf: [
        { $ref: "#/components/schemas/SuccessEnvelope" },
        { type: "object", properties: { data: schema } },
    ],
});

export const flatEnvelope = (properties: Record<string, unknown>) => ({
    allOf: [{ $ref: "#/components/schemas/SuccessEnvelope" }, { type: "object", properties }],
});

export const listOf = (name: string, ref: string) =>
    envelope({ [name]: { type: "array", items: { $ref: `#/components/schemas/${ref}` } } });

export const flatListOf = (name: string, ref: string) =>
    flatEnvelope({ [name]: { type: "array", items: { $ref: `#/components/schemas/${ref}` } } });

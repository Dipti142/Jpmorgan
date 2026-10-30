import { listOf } from "./commonSchema";

export const companySchemas = {
    Company: {
        type: "object",
        properties: {
            id: { type: "integer", example: 7 },
            key: { type: "string", example: "baystate" },
            name: { type: "string", example: "Baystate Interpreters" },
            // Prefixes every tool name in Anam, so two companies never collide.
            toolPrefix: { type: "string", example: "baystate_" },
            kbFolder: { type: "string", example: "baystate" },
        },
    },

    GetCompaniesResponse: listOf("companies", "Company"),
};

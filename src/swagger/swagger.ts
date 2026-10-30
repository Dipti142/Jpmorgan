import { Express } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Env } from "../config/env.config";
import { commonSchemas } from "../schema/commonSchema";
import { companySchemas } from "../schema/companySchema";
import { customScriptSchemas } from "../schema/customScriptSchema";
import { interviewSchemas } from "../schema/interviewSchema";
import { responsesSchema } from "../schema/responsesSchema";
import { teamsSchemas } from "../schema/teamsSchema";
import { virtualAvatarSchemas } from "../schema/virtualAvatarSchema";
import { workableSchemas } from "../schema/workableSchema";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Agentic Avatar Service",
            version: "1.0.0",
            description:
                "Anam avatar persona microservice. Every read is scoped by companyId - a vendor id alone identifies nobody, by design.",
        },
        servers: [{ url: `http://localhost:${Env.server_port}`, description: "Development server" }],
        tags: [
            { name: "Companies", description: "Pick a company before anything else" },
            { name: "Interview", description: "Candidates, the call outline, and readiness" },
            { name: "Interview Tools", description: "Called by Anam mid-call, never by a console" },
            { name: "Scripts", description: "Question sets, the headings that gather them, and which job roles run them" },
            { name: "Teams", description: "Sending a persona into a Microsoft Teams, Zoom or Meet call" },
            { name: "VA", description: "Azure video calls: sessions, the lobby, recordings, and the join page" },
            { name: "Workable", description: "Candidate webhooks from Workable" },
        ],
        components: {
            securitySchemes: {
                // Bearer token from the user-authentication microservice. Not wired yet.
                bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
                // Shared secret Anam sends on the /tools/* webhooks. Fails closed if unset.
                toolSecret: { type: "apiKey", in: "header", name: "X-Tool-Secret" },
            },
            schemas: {
                ...commonSchemas,
                ...companySchemas,
                ...interviewSchemas,
                ...customScriptSchemas,
                ...teamsSchemas,
                ...virtualAvatarSchemas,
                ...workableSchemas,
            },
            responses: {
                ...responsesSchema,
            },
        },
    },
    // ** matters: interview routes live one folder down and were being missed.
    apis: ["./src/routes/**/*.ts"],
};

export const spec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec, {
        customSiteTitle: "Agentic Avatar API Documentation",
    }));
};

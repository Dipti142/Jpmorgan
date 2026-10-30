import { Env } from "../config/env.config";
import Company from "../models/company.model";
import { IAnamToolDefinition, IToolBlueprint } from "../interfaces/IAnamTool.interface";

export const toolNameFor = (company: Pick<Company, "tool_prefix">, key: string): string => {
    const name = `${company.tool_prefix}${key}`;
    if (name.length > 64) throw new Error(`Tool name "${name}" exceeds Anam's 64-character limit`);
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Tool name "${name}" must be snake_case`);
    return name;
};

/**
 * The definition Anam stores. Two headers matter:
 *
 *   X-Tool-Secret  - proves the call came from Anam and not from anyone who
 *                    guessed the URL, checked by anamToolSecret.
 *   X-Company-Id   - fixed when the tool is provisioned, so which company a
 *                    call belongs to is never something the model gets to say.
 */
export const renderToolDefinition = (
    blueprint: IToolBlueprint,
    company: Pick<Company, "company_id" | "tool_prefix">,
): IAnamToolDefinition => {
    const name = toolNameFor(company, blueprint.key);

    // Anam runs this one itself against the uploaded documents, so there is no callback.
    if (blueprint.kind === "knowledge") {
        if (!Env.anam.knowledge_group_id) {
            throw new Error(
                "ANAM_KNOWLEDGE_GROUP_ID is not set - run npm run sync:knowledge:dev to create the folder",
            );
        }

        return {
            type: "SERVER_RAG",
            name,
            description: blueprint.description,
            ...(blueprint.disableInterruptions ? { disableInterruptions: true } : {}),
            config: {
                documentFolderIds: [Env.anam.knowledge_group_id],
                topK: 3,
                minScore: 0.4,
                maxContextTokens: 6000,
            },
        };
    }

    // Runs in the browser's SDK, so there is no URL to call back and no secret to carry.
    if (blueprint.kind === "client") {
        return {
            type: "CLIENT",
            name,
            description: blueprint.description,
            config: {
                parameters: blueprint.parameters,
                awaitResult: blueprint.awaitResult ?? false,
            },
        };
    }

    if (!blueprint.path) throw new Error(`Webhook tool "${blueprint.key}" needs a path`);
    if (!Env.anam.public_base_url) {
        throw new Error("AGENTIC_AVATAR_BASE_URL is not set - Anam would have nowhere to call back");
    }
    if (!Env.anam.tool_shared_secret) {
        throw new Error("ANAM_TOOL_SHARED_SECRET is not set - the webhooks would be unauthenticated");
    }

    return {
        type: "SERVER_WEBHOOK",
        name,
        description: blueprint.description,
        ...(blueprint.disableInterruptions ? { disableInterruptions: true } : {}),
        config: {
            url: `${Env.anam.public_base_url}${blueprint.path}`,
            method: blueprint.method ?? "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Tool-Secret": Env.anam.tool_shared_secret,
                "X-Company-Id": String(company.company_id),
            },
            awaitResponse: blueprint.awaitResponse ?? true,
            // Inside config, not top level - Anam drops a top-level parameters key.
            parameters: blueprint.parameters,
        },
    };
};

import { Env } from "../config/env.config";
import { listKnowledgeDocuments } from "./anam.service";
import AnamTool from "../models/anamTool.model";
import { IAnamSessionOptions } from "../interfaces/IAnamMeeting.interface";
import { IAnamPersonaConfig, IBuiltPersonaConfig } from "../interfaces/IAnamPersona.interface";
import { IMintSessionInput } from "../types/services/anam.type";

/**
 * Turns a resolved persona into an Anam personaConfig. The only thing that knows
 * how the pieces fit together, so every programme kind assembles a persona the
 * same way.
 *
 * It stops short of joining anything: the meeting invite is what carries this to
 * Anam - see anamMeeting.service.ts.
 */

/** The provisioned UUIDs for the tools this session needs, looked up by key. */
const resolveToolIds = async (
    companyId: number,
    toolKeys: string[],
): Promise<{ toolIds: string[]; toolNames: string[]; missing: string[] }> => {
    if (!toolKeys.length) return { toolIds: [], toolNames: [], missing: [] };

    const tools = await AnamTool.findAll({
        where: { company_id: companyId, is_active: 1 },
    });

    const byKey = new Map(tools.map((tool) => [tool.tool_key, tool]));
    const toolIds: string[] = [];
    const toolNames: string[] = [];
    const missing: string[] = [];

    for (const key of toolKeys) {
        const tool = byKey.get(key);
        if (tool) {
            toolIds.push(tool.remote_tool_id);
            toolNames.push(tool.tool_name);
        } else {
            missing.push(key);
        }
    }

    return { toolIds, toolNames, missing };
};

export const buildPersonaConfig = async (input: IMintSessionInput): Promise<IBuiltPersonaConfig> => {
    const { toolIds, toolNames, missing } = await resolveToolIds(
        Number(input.company.company_id),
        input.toolKeys,
    );

    // Starting without the tools would give a persona that can talk but not
    // look anything up or record anything - a worse failure than not starting.
    if (missing.length) {
        throw new Error(
            `Tools not provisioned for ${input.company.company_key}: ${missing.join(", ")}. ` +
                `Run npm run provision:anam:dev`,
        );
    }

    const personaConfig: IAnamPersonaConfig = {
        name: input.avatar.display_name,
        avatarId: input.avatar.avatar_id,
        avatarModel: input.avatar.avatar_model,
        voiceId: input.avatar.voice_id,
        systemPrompt: input.systemPrompt,
        directorNotes: input.persona.directorNotes,
        toolIds,
        uninterruptibleGreeting: Env.anam.uninterruptible_greeting,
        voiceDetectionOptions: {
            sttProvider: "cartesia_ink_2",
            endOfSpeechSensitivity: 1,
            speechEnhancementLevel: 1,
        }
    };

    if (input.avatar.llm_id) personaConfig.llmId = input.avatar.llm_id;

    return { personaConfig, toolNames };
};


export const buildVideoSessionOptions = (): IAnamSessionOptions => {
    const options: IAnamSessionOptions = {};

    const quality = String(Env.anam.video_quality ?? "").trim().toLowerCase();
    if (quality === "low" || quality === "medium" || quality === "high") {
        options.videoQuality = quality;
    }

    if (Number.isFinite(Env.anam.video_width) && Env.anam.video_width > 0) {
        options.videoWidth = Env.anam.video_width;
    }
    if (Number.isFinite(Env.anam.video_height) && Env.anam.video_height > 0) {
        options.videoHeight = Env.anam.video_height;
    }

    return options;
};

/** What GET /v1/interview/config reports before anyone starts a call. */
export const describeAnamReadiness = (): { ready: boolean; missing: string[] } => {
    const missing: string[] = [];
    if (!Env.anam.anam_api_key) missing.push("ANAM_API_KEY");
    if (!Env.anam.public_base_url) missing.push("AGENTIC_AVATAR_BASE_URL");
    if (!Env.anam.tool_shared_secret) missing.push("ANAM_TOOL_SHARED_SECRET");
    if (!Env.anam.knowledge_group_id) missing.push("ANAM_KNOWLEDGE_GROUP_ID");
    return { ready: missing.length === 0, missing };
};

/** A document stuck short of READY is why the persona cannot answer, so the config page shows it. */
export const describeKnowledgeGroup = async (): Promise<{
    groupId: string;
    ready: boolean;
    documents: { filename: string; status: string }[];
}> => {
    const groupId = Env.anam.knowledge_group_id;
    if (!groupId) return { groupId: "", ready: false, documents: [] };

    const documents = await listKnowledgeDocuments(groupId).catch(() => []);

    return {
        groupId,
        ready: documents.length > 0 && documents.every((document) => document.status === "READY"),
        documents: documents.map((document) => ({
            filename: document.filename ?? document.id,
            status: document.status,
        })),
    };
};

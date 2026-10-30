import { GUARDRAILS, TONE } from "../constants/prompt.rules";

/**
 * Anam's five building blocks, in the order the prompting guide specifies, with
 * the tool and cue sections it adds. Tone and Guardrails hold for every
 * programme kind; the rest arrive from the caller.
 *
 * https://anam.ai/docs/personas/llms/prompting-guide
 */

export interface IBuildPromptInput {
    characterPrompt: string;
    personaName: string;
    companyName: string;
    subjectBrief: string;
    roomConduct: string;
    script: string;
    toolUse: string | null;
    toolCallingRules: string | null;
    directorNotes: string | null;
    /** Folded into Guardrails - a session with no tools must not promise to record anything. */
    extraGuardrails?: string | null;
}

const block = (heading: string, body: string): string => {
    const text = String(body ?? "").trim();
    return text ? `${heading}\n${text}` : "";
};

export const buildSystemPrompt = (input: IBuildPromptInput): string => {
    const personaName = String(input.personaName ?? "").trim();
    if (!personaName) {
        throw new Error("buildSystemPrompt needs a personaName - it is the name the persona speaks as");
    }

    const environment = [`You are doing this for ${input.companyName}.`, input.subjectBrief, input.roomConduct]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join("\n");

    const guardrails = [GUARDRAILS, input.extraGuardrails]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join("\n\n");

    const sections = [
        block("# Personality", String(input.characterPrompt ?? "")
            .replace(/\{\{\s*personaName\s*\}\}/g, () => personaName)),
        block("# Environment", environment),
        block("# Tone", TONE),
        block("# Goal", input.script),
        block("# Tool use", input.toolUse ?? ""),
        block("# Tool calling rules", input.toolCallingRules ?? ""),
        block("# Director Notes", input.directorNotes ?? ""),
        block("# Guardrails", guardrails),
    ];
    return sections.filter(Boolean).join("\n\n");
};

export const renderTokens = (template: string, tokens: Record<string, string | number | null | undefined>): string =>
    String(template ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
        const value = tokens[key];
        return value === null || value === undefined ? "" : String(value);
    }).replace(/[ \t]{2,}/g, " ").trim();

import { AnamDirectorNotes, AnamPresetStyle } from "./IAnamPersona.interface";

export interface IStepTool {
    name: string;
    args?: Record<string, unknown>;
}

export type ProgramKind = "INTERVIEW" | "ORIENTATION";

export type DefaultScriptRole = "ORGANISER" | "AGENT";

export type DefaultScriptType = "DEFAULT" | "OPTIONAL";

/**
 * The pattern *code*, which is still what the API speaks and what a caller
 * sends. The database stores the id of the tl_question_pattern row carrying it.
 */
export type DefaultScriptPattern = "GREETING" | "CHECKLIST" | "QUESTION_ANSWER" | "SCENARIO" | "INTERVIEW_CONCLUSION";

/** A pattern row as the migration and seeder write it. */
export interface IQuestionPatternSeed {
    pattern_code: DefaultScriptPattern;
    pattern_label: string;
    question_kind: string;
    rating_required_default: boolean;
    display_order: number;
}

export interface IDefaultScriptQuestion {
    key: string;
    title: string;
    kind: string;
    order: number;
    required?: boolean;
    question: string;
    context: string;
    expectedAnswer?: string;
    captureFields?: string[];
    evaluationGuidance?: string;
    // Absent means "whatever the pattern implies" - a custom script overrides per question.
    ratingRequired?: boolean;
    tool?: IStepTool;
    expected_responses?: Record<string, string>;
    isActive?: boolean;
}

export interface IPersonaDefinition {
    personaKey: string;
    personaRole: string;
    characterPrompt: string;
    avatarSelectionMode: "RANDOM" | "FIXED";
    avatarPool: string[];
    fixedAvatarKey?: string;
    isActive?: boolean;
    presetStyles: AnamPresetStyle[];
    directorNotes: AnamDirectorNotes;
    displayOrder: number;
}

export interface IProgramManifest {
    programKey: string;
    programName: string;
    programKind: string;
    companyKey: string;
    kbDomain: string;
    personas: IPersonaDefinition[];
}

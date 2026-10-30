import { DefaultScriptPattern, DefaultScriptRole, IStepTool, ProgramKind } from "./IProgram.interface";

// Which table the script was read from.
export type ScriptMode = "custom" | "default";

export interface IScriptQuestion {
    key: string;
    title: string;
    kind: string;
    order: number;
    required: boolean;
    question: string;
    context?: string;
    expectedAnswer?: string;
    captureFields: string[];
    evaluationGuidance?: string;
    ratingRequired: boolean;
    tool?: IStepTool;
    responses: Record<string, string>;
}

// One tl_default_script row, or one tl_custom_script_set row.
export interface IScriptSet {
    key: string;
    title: string;
    pattern: DefaultScriptPattern;
    role: DefaultScriptRole;
    order: number;
    // The pattern's default, not a promise about every question in the set.
    ratingRequired: boolean;
    questions: IScriptQuestion[];
}

// The names a DB-authored script writes into its own text as [agent_name],
// [company_name] and [candidate_name]. Keys are the placeholder spellings.
export interface IScriptPlaceholders {
    agent_name: string;
    company_name: string;
    candidate_name: string;
}

export interface IScriptBuildInput {
    companyId: number;
    programKind: ProgramKind;
    participantRole?: DefaultScriptRole;
    // Which job role's custom script to look for. Absent means the default one.
    jobShortCode?: string | null;
    scriptTemplateId?: number | null;
    isOngoing?: boolean;
    // Absent leaves the placeholders standing - which is what a console preview wants.
    placeholders?: IScriptPlaceholders;
    // No opening: the GREETING set is the opening, and it comes from the database.
    closing?: string[];
}

export interface IResolvedScript {
    sets: IScriptSet[];
    questions: IScriptQuestion[];
    mode: ScriptMode;
}

export interface IBuiltScript extends IResolvedScript {
    script: string;
}

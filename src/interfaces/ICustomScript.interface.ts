import {
    DefaultScriptPattern,
    DefaultScriptRole,
    DefaultScriptType,
    IDefaultScriptQuestion,
    ProgramKind,
} from "./IProgram.interface";


export interface IScriptQuestionInput {
    question: string;
    expectedAnswer?: string;
    required?: boolean;
    context?: string;
    evaluationGuidance?: string;
    ratingRequired?: boolean;
    expected_responses?: Record<string, string>;
    isActive?: boolean;
}

// POST /v1/scripts - one question set of one pattern.
export interface ICreateScriptSetRequest {
    companyId: number;
    scriptId?: number | null;
    questionPattern: DefaultScriptPattern;
    scriptName: string;
    questions: IScriptQuestionInput[];
    // From req.user.userID (the auth middleware), never the request body.
    updatedBy?: number | null;
    // Same caller, recorded only on the row this request actually creates.
    createdBy?: number | null;
}

/** What actually goes into the questions column, once the gaps are filled. */
export type IStoredScriptQuestion = IDefaultScriptQuestion;

// POST /v1/scripts/templates - the heading, and the sets gathered under it.
export interface ICreateScriptTemplateRequest {
    // From req.user.companyID (the auth middleware), never the request body.
    companyId: number;
    programKind: ProgramKind;
    templateKey?: string;
    templateName: string;
    templateDescription?: string | null;
    scriptSetIds: number[];
    updatedBy?: number | null;
    createdBy?: number | null;
}

export interface IUpdateScriptTemplateRequest {
    companyId: number;
    templateName?: string;
    templateDescription?: string | null;
    scriptSetIds?: number[];
    /** 0 or 1 - matches the tl_custom_script_template.is_active column. */
    isActive?: number;
    /** Says the caller has read which job roles a set-list change would reach. */
    acknowledgeImpact?: boolean;
    updatedBy?: number | null;
}

// POST /v1/scripts/assign - which job roles run which heading.
export interface IAssignScriptRequest {
    companyId: number;
    /** The heading they run, by its uuid. */
    scriptUuid: string;
    participantRole?: DefaultScriptRole;
    /** One or more job roles. Every one of them gets the same heading. */
    jobRoles: Array<{ jobShortCode: string; jobLabel?: string | null }>;
    assign: 0 | 1;
    /** 1 unassigns the job role(s) instead, dropping them back to the default script. */
    remove: 0 | 1;
    updatedBy?: number | null;
    createdBy?: number | null;
}

export interface IScriptSetView {
    scriptId: number;
    questionPattern: DefaultScriptPattern;
    scriptName: string;
    questionCount: number;
    isActive: number;
    createdTs: Date;
}

// The questions come back only from the single-set read, never from the listing.
export interface IScriptSetDetailView extends IScriptSetView {
    questions: IDefaultScriptQuestion[];
}

export interface IScriptTemplateView {
    scriptUuid: string;
    templateKey: string;
    templateName: string;
    templateDescription: string | null;
    programKind: ProgramKind;
    scriptSetIds: number[];
    setCount: number;
    isActive: number;
    createdTs: Date;
}

// GET /v1/scripts/patterns - the fixed catalogue a createScriptSet call picks questionPattern from.
export interface IQuestionPatternView {
    patternCode: DefaultScriptPattern;
    patternLabel: string;
    questionKind: string;
    ratingRequiredDefault: boolean;
    displayOrder: number;
}


export interface IUpdateCustomScriptRequest {
    companyId: number;
    scriptId: number;
    scriptUuid: string;
    questionPattern: DefaultScriptPattern;
    scriptName: string;
    questions: IScriptQuestionInput[];
    updatedBy?: number | null;
    createdBy?: number | null;
}

export interface IUpdateCustomScriptResponse {
    script: IScriptSetDetailView;
    previousScriptId: number;
    previousScriptUuid: string;
    scriptUuid: string;
    reassignedRoles: IRoleScriptView[];
}

// GET /v1/scripts/templates/:scriptUuid - the set plus who is already assigned to the heading it sits under.
export interface IScriptTemplateSetView {
    script: IScriptSetDetailView | null;
    assignedRoles: IRoleScriptView[];
}

export interface IRoleScriptView {
    customScriptId: number;
    jobShortCode: string;
    jobLabel: string | null;
    programKind: ProgramKind;
    participantRole: DefaultScriptRole;
    scriptUuid: string;
    templateName: string;
}

// GET /v1/scripts/default - what a role speaks when no custom heading is assigned.
export interface IDefaultScriptView {
    defaultScriptId: number;
    questionPattern: DefaultScriptPattern;
    participantRole: DefaultScriptRole;
    scriptType: DefaultScriptType;
    scriptKey: string;
    scriptName: string;
    scriptOrder: number;
    isActive: number;
    questions: IDefaultScriptQuestion[];
    createdTs: Date;
}

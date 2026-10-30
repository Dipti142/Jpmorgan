import { Op, Transaction } from "sequelize";
import { IStoredScriptQuestion } from "../interfaces/ICustomScript.interface";
import { DefaultScriptRole, ProgramKind } from "../interfaces/IProgram.interface";
import CustomScript from "../models/customScript.model";
import CustomScriptSet from "../models/customScriptSet.model";
import CustomScriptTemplate from "../models/customScriptTemplate.model";
import QuestionPattern from "../models/questionPattern.model";

export interface ICustomScriptQuery {
    companyId: number;
    programKind: ProgramKind;
    participantRole: DefaultScriptRole;
    jobShortCode: string;
}

/* -- the sets -------------------------------------------------------------- */

export interface ICreateSetInput {
    companyId: number;
    questionPatternId: number;
    scriptName: string;
    questions: IStoredScriptQuestion[];
    updatedBy?: number | null;
    createdBy?: number | null;
}
const WITH_PATTERN = [{ model: QuestionPattern, as: "pattern", required: true }];

export const createSet = async ( input: ICreateSetInput, transaction?: Transaction,): Promise<CustomScriptSet> =>
    CustomScriptSet.create(
        {
            question_pattern_id: input.questionPatternId,
            script_name: input.scriptName,
            questions: input.questions,
            updated_by: input.updatedBy ?? null,
            created_by: input.createdBy ?? null,
        },
        { transaction },
    );

export const findSet = async (setId: number, transaction?: Transaction, lock = false,): Promise<CustomScriptSet | null> =>
    CustomScriptSet.findOne({
        where: { custom_script_set_id: setId },
        include: WITH_PATTERN,
        transaction,
        ...(lock ? { lock: Transaction.LOCK.UPDATE } : {}),
    });

export const listSets = async (companyId: number, questionPatternId?: number,): Promise<CustomScriptSet[]> =>
    CustomScriptSet.findAll({
        where: {
            is_active: 1,
            ...(questionPatternId ? { question_pattern_id: questionPatternId } : {}),
        },
        include: WITH_PATTERN,
        order: [["custom_script_set_id", "ASC"]],
    });

export const listSetsByIds = async (  setIds: number[],  transaction?: Transaction,  activeOnly = true,): Promise<CustomScriptSet[]> => {
    if (!setIds.length) return [];
    return CustomScriptSet.findAll({
        where: {
            custom_script_set_id: { [Op.in]: setIds },
            ...(activeOnly ? { is_active: 1 } : {}),
        },
        include: WITH_PATTERN,
        transaction,
    });
};

/* -- the heading ----------------------------------------------------------- */

export interface ICreateTemplateInput {
    companyId: number;
    scriptUuid: string;
    programKind: ProgramKind;
    templateKey: string;
    templateName: string;
    templateDescription?: string | null;
    scriptSetIds: number[];
    updatedBy?: number | null;
    createdBy?: number | null;
}

export const createTemplate = async (
    input: ICreateTemplateInput,
    transaction?: Transaction,
): Promise<CustomScriptTemplate> =>
    CustomScriptTemplate.create(
        {
            company_id: input.companyId,
            script_uuid: input.scriptUuid,
            program_kind: input.programKind,
            template_key: input.templateKey,
            template_name: input.templateName,
            template_description: input.templateDescription ?? null,
            script_set_ids: input.scriptSetIds,
            updated_by: input.updatedBy ?? null,
            created_by: input.createdBy ?? null,
        },
        { transaction },
    );

export const findTemplateByUuid = async (
    companyId: number,
    scriptUuid: string,
    transaction?: Transaction,
    lock = false,
): Promise<CustomScriptTemplate | null> =>
    CustomScriptTemplate.findOne({
        where: { company_id: companyId, script_uuid: scriptUuid },
        transaction,
        ...(lock ? { lock: Transaction.LOCK.UPDATE } : {}),
    });

export const findTemplateByUuidGlobal = async (
    scriptUuid: string,
    transaction?: Transaction,
): Promise<CustomScriptTemplate | null> =>
    CustomScriptTemplate.findOne({
        where: { script_uuid: scriptUuid },
        transaction,
    });

export const findTemplateById = async (companyId: number, templateId: number,): Promise<CustomScriptTemplate | null> =>
    CustomScriptTemplate.findOne({
        where: { company_id: companyId, custom_script_template_id: templateId },
    });

export const getTabs = async (): Promise<QuestionPattern[]> =>
    QuestionPattern.findAll({
        where: {
            is_active: 1,
        },
        order: [["display_order", "ASC"]],
    });

export const findTemplateByKey = async ( companyId: number,  templateKey: string,  transaction?: Transaction,): Promise<CustomScriptTemplate | null> =>
    CustomScriptTemplate.findOne({
        where: { company_id: companyId, template_key: templateKey },
        transaction,
    });

export const listTemplatesUsingSet = async (
    companyId: number,
    setId: number,
    transaction?: Transaction,
): Promise<CustomScriptTemplate[]> =>
    CustomScriptTemplate.findAll({
        where: {
            company_id: companyId,
            is_active: 1,
            deleted_ts: null,
            script_set_ids: { [Op.contains]: [setId] },
        },
        order: [["custom_script_template_id", "ASC"]],
        transaction,
    });

export const listTemplatesUsingSetGlobal = async ( setId: number,  transaction?: Transaction,): Promise<CustomScriptTemplate[]> =>
    CustomScriptTemplate.findAll({
        where: {
            is_active: 1,
            deleted_ts: null,
            script_set_ids: { [Op.contains]: [setId] },
        },
        order: [["custom_script_template_id", "ASC"]],
        transaction,
    });

/* -- which role runs which heading ----------------------------------------- */

export const findScriptForRole = async (  query: ICustomScriptQuery, transaction?: Transaction, lock = false,): Promise<CustomScript | null> =>
    CustomScript.findOne({
        where: {
            company_id: query.companyId,
            program_kind: query.programKind,
            participant_role: query.participantRole,
            job_short_code: query.jobShortCode,
            is_active: 1,
            deleted_ts: null,
        },
        transaction,
        ...(lock ? { lock: Transaction.LOCK.UPDATE } : {}),
    });

/** Every live row among a batch of roles - what the assign flag checks before it writes anything. */
export const findAssignmentsForRoles = async (
    query: { companyId: number; programKind: ProgramKind; participantRole: DefaultScriptRole; jobShortCodes: string[] },
    transaction?: Transaction,
): Promise<CustomScript[]> =>
    CustomScript.findAll({
        where: {
            company_id: query.companyId,
            program_kind: query.programKind,
            participant_role: query.participantRole,
            job_short_code: { [Op.in]: query.jobShortCodes },
            is_active: 1,
            deleted_ts: null,
        },
        include: [{ model: CustomScriptTemplate, as: "template" }],
        transaction,
    });

/** Every live assignment for a company, optionally narrowed to one role or heading. */
export const listAssignments = async (
    companyId: number,
    filter: { jobShortCode?: string; templateId?: number } = {},
): Promise<CustomScript[]> =>
    CustomScript.findAll({
        where: {
            company_id: companyId,
            deleted_ts: null,
            ...(filter.jobShortCode ? { job_short_code: filter.jobShortCode } : {}),
            ...(filter.templateId ? { custom_script_template_id: filter.templateId } : {}),
        },
        include: [{ model: CustomScriptTemplate, as: "template" }],
        order: [["job_short_code", "ASC"]],
    });

export const listTemplates = async (companyId: number, programKind?: ProgramKind,): Promise<CustomScriptTemplate[]> =>
    CustomScriptTemplate.findAll({
        where: {
            company_id: companyId,
            is_active: 1,
            deleted_ts: null,
            ...(programKind ? { program_kind: programKind } : {}),
        },
        order: [["custom_script_template_id", "ASC"]],
    });
import { randomUUID } from "node:crypto";
import { Transaction } from "sequelize";
import { trace } from "../helpers/trace.helper";
import {
    IAssignScriptRequest,
    ICreateScriptSetRequest,
    ICreateScriptTemplateRequest,
    IDefaultScriptView,
    IQuestionPatternView,
    IRoleScriptView,
    IScriptQuestionInput,
    IScriptSetDetailView,
    IScriptSetView,
    IScriptTemplateSetView,
    IScriptTemplateView,
    IStoredScriptQuestion,
    IUpdateCustomScriptRequest,
    IUpdateCustomScriptResponse
} from "../interfaces/ICustomScript.interface";
import { DefaultScriptPattern, DefaultScriptRole, ProgramKind } from "../interfaces/IProgram.interface";
import CustomScript from "../models/customScript.model";
import CustomScriptSet from "../models/customScriptSet.model";
import CustomScriptTemplate from "../models/customScriptTemplate.model";
import QuestionPattern from "../models/questionPattern.model";
import connection from "../models/index";
import * as customScripts from "../repositories/customScript.repository";
import * as defaultScripts from "../repositories/defaultScript.repository";
import { IDefaultScriptQuery } from "../repositories/defaultScript.repository";
import * as questionPatterns from "../repositories/questionPattern.repository";

// Spoken, never asked or recorded - a required greeting/closing would block submission forever.
const SPOKEN_PATTERNS = new Set<DefaultScriptPattern>(["GREETING"]);

// Which tool records an answer to this pattern - GREETING has none, it is spoken only.
const TOOL_BY_PATTERN: Partial<Record<DefaultScriptPattern, { name: string }>> = {
    CHECKLIST: { name: "record_checklist" },
    QUESTION_ANSWER: { name: "record_answer" },
    SCENARIO: { name: "record_answer" },
    INTERVIEW_CONCLUSION: { name: "submit_interview" },
};

const slugify = (text: string, words = 8): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .split(/\s+/)
        .slice(0, words)
        .join("-")
        .slice(0, 60) || "question";

const templateKeyRoot = (key: string): string => key.replace(/(-\d+)+$/, "");

const nextAvailableKey = async (base: string, taken: (candidate: string) => Promise<boolean>,): Promise<string> => {
    let candidate = base;
    let suffix = 2;
    while (await taken(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    return candidate;
};

const titleFrom = (question: string): string => {
    const words = question.replace(/\s+/g, " ").trim().split(" ");
    const short = words.slice(0, 8).join(" ").slice(0, 150);
    return short.charAt(0).toUpperCase() + short.slice(1);
};

const fillQuestions = (questions: IScriptQuestionInput[], pattern: QuestionPattern,): IStoredScriptQuestion[] => {
    const used = new Set<string>();
    const spoken = SPOKEN_PATTERNS.has(pattern.pattern_code);
    const tool = TOOL_BY_PATTERN[pattern.pattern_code];

    return questions.map((input, index) => {
        const base = slugify(input.question);
        let key = base;
        let suffix = 2;
        while (used.has(key)) {
            key = `${base}-${suffix}`;
            suffix += 1;
        }
        used.add(key);

        return {
            key,
            title: titleFrom(input.question),
            kind: pattern.question_kind,
            order: index + 1,
            required: input.required ?? !spoken,
            question: input.question,
            context: input.context ?? "",
            ...(input.expectedAnswer ? { expectedAnswer: input.expectedAnswer } : {}),
            ...(input.evaluationGuidance ? { evaluationGuidance: input.evaluationGuidance } : {}),
            ...(input.ratingRequired === undefined ? {} : { ratingRequired: input.ratingRequired }),
            ...(tool ? { tool } : {}),
            expected_responses: input.expected_responses ?? {},
            isActive: input.isActive ?? true,
        };
    });
};


const describeSet = (set: CustomScriptSet): IScriptSetView => ({
    scriptId: Number(set.custom_script_set_id),
    questionPattern: set.pattern.pattern_code,
    scriptName: set.script_name,
    questionCount: (set.questions ?? []).length,
    isActive: set.is_active,
    createdTs: set.created_ts,
});

const resolvePattern = async (code: DefaultScriptPattern): Promise<QuestionPattern> => {
    const pattern = await questionPatterns.findPatternByCode(code);
    if (!pattern) throw new Error(`No active question pattern "${code}"`);
    return pattern;
};

export const listActivePatterns = async (): Promise<IQuestionPatternView[]> => {
    const patterns = await questionPatterns.listPatterns();
    return patterns.map((pattern) => ({
        patternCode: pattern.pattern_code,
        patternLabel: pattern.pattern_label,
        questionKind: pattern.question_kind,
        ratingRequiredDefault: pattern.rating_required_default,
        displayOrder: pattern.display_order,
    }));
};

export const listDefaultScript = async (query: IDefaultScriptQuery): Promise<IDefaultScriptView[]> => {
    const rows = await defaultScripts.listScripts(query);
    return rows.map((row) => ({
        defaultScriptId: Number(row.default_script_id),
        questionPattern: row.pattern.pattern_code,
        participantRole: row.participant_role,
        scriptType: row.script_type,
        scriptKey: row.script_key,
        scriptName: row.script_name,
        scriptOrder: row.script_order,
        isActive: row.is_active,
        questions: row.questions ?? [],
        createdTs: row.created_ts,
    }));
};

export const createScriptSet = async (input: ICreateScriptSetRequest): Promise<IScriptSetDetailView> => {
    const pattern = await resolvePattern(input.questionPattern);
    const questions = fillQuestions(input.questions, pattern);
    const scriptId = input.scriptId;
    if (scriptId) {
        return connection.transaction(async (transaction) => {
            const oldSet = await customScripts.findSet(scriptId, transaction, true);
            if (!oldSet) throw new Error(`No script ${scriptId}`);
            if (!oldSet.is_active) throw new Error(`Conflict: script ${scriptId} is already retired`);

            const { script } = await updateSetInPlace(
                { ...input, scriptId },
                oldSet,
                pattern,
                questions,
                transaction,
            );
            return script;
        });
    }

    const set = await customScripts.createSet({
        companyId: input.companyId,
        questionPatternId: Number(pattern.question_pattern_id),
        scriptName: input.scriptName,
        questions,
        updatedBy: input.updatedBy ?? null,
        createdBy: input.createdBy ?? null,
    });

    trace("script", input.scriptName, "set_created", {
        scriptId: Number(set.custom_script_set_id),
        pattern: pattern.pattern_code,
        questions: questions.length,
    });

    set.pattern = pattern;
    return { ...describeSet(set), questions };
};

export const listScriptSets = async (
    companyId: number,
    questionPattern?: DefaultScriptPattern,
): Promise<IScriptSetView[]> => {
    const pattern = questionPattern ? await resolvePattern(questionPattern) : undefined;
    const sets = await customScripts.listSets(
        companyId,
        pattern ? Number(pattern.question_pattern_id) : undefined,
    );
    return sets.map(describeSet);
};

// companyId is accepted for request symmetry but does not scope the lookup - sets are global.
export const getScriptSet = async (companyId: number, setId: number): Promise<IScriptSetDetailView> => {
    const set = await customScripts.findSet(setId);
    if (!set) throw new Error(`No script ${setId}`);

    return { ...describeSet(set), questions: set.questions ?? [] };
};

/* -- the heading ----------------------------------------------------------- */

const assertSetsExist = async (companyId: number, scriptSetIds: number[], transaction?: Transaction,): Promise<CustomScriptSet[]> => {
    const found = await customScripts.listSetsByIds(scriptSetIds, transaction);
    const known = new Set(found.map((set) => Number(set.custom_script_set_id)));
    const missing = scriptSetIds.filter((setId) => !known.has(setId));

    if (missing.length) {
        throw new Error(`No active script ${missing.join(", ")}`);
    }

    return found;
};

const assertKeysUniqueAcrossSets = (sets: CustomScriptSet[]): void => {
    const seen = new Map<string, string>();

    for (const set of sets) {
        for (const question of set.questions ?? []) {
            const owner = seen.get(question.key);
            if (owner) {
                throw new Error(
                    `Conflict: question key "${question.key}" is in both "${owner}" and "${set.script_name}"`,
                );
            }
            seen.set(question.key, set.script_name);
        }
    }
};

const assertNoDuplicateIds = (scriptSetIds: number[]): void => {
    const duplicate = scriptSetIds.find((setId, index) => scriptSetIds.indexOf(setId) !== index);
    if (duplicate) {
        throw new Error(`Conflict: script ${duplicate} is listed twice under this heading`);
    }
};


const assertSetsNotClaimedElsewhere = async (
    companyId: number,
    scriptSetIds: number[],
    transaction?: Transaction,
    excludeTemplateId?: number,
): Promise<void> => {
    for (const setId of scriptSetIds) {
        const usedBy = await customScripts.listTemplatesUsingSet(companyId, setId, transaction);
        const conflicting = excludeTemplateId
            ? usedBy.filter((row) => Number(row.custom_script_template_id) !== excludeTemplateId)
            : usedBy;

        if (conflicting.length) {
            const names = conflicting.map((row) => `${row.template_key} (${row.script_uuid})`).join(", ");
            throw new Error(
                `Conflict: script ${setId} is already gathered by heading(s) ${names} - ` +
                `a question set can only belong to one active heading at a time`,
            );
        }
    }
};


const checkSetList = async (
    companyId: number,
    scriptSetIds: number[],
    transaction?: Transaction,
    excludeTemplateId?: number,
): Promise<CustomScriptSet[]> => {
    assertNoDuplicateIds(scriptSetIds);
    const sets = await assertSetsExist(companyId, scriptSetIds, transaction);
    assertKeysUniqueAcrossSets(sets);
    await assertSetsNotClaimedElsewhere(companyId, scriptSetIds, transaction, excludeTemplateId);
    return sets;
};

const templateImpact = async (companyId: number, templateId: number) => {
    const rows = await customScripts.listAssignments(companyId, { templateId });
    const assignedRoles = rows.map(describeAssignment);
    return { assignedRoles };
};

const describeTemplate = (template: CustomScriptTemplate): IScriptTemplateView => {
    const scriptSetIds = (template.script_set_ids ?? []).map(Number);

    return {
        scriptUuid: template.script_uuid,
        templateKey: template.template_key,
        templateName: template.template_name,
        templateDescription: template.template_description,
        programKind: template.program_kind,
        scriptSetIds,
        setCount: scriptSetIds.length,
        isActive: template.is_active,
        createdTs: template.created_ts,
    };
};

export const createScriptTemplate = async (input: ICreateScriptTemplateRequest): Promise<IScriptTemplateView> => {
    const templateKey = input.templateKey ?? slugify(input.templateName);
    const scriptSetIds = input.scriptSetIds.map(Number);

    const clash = await customScripts.findTemplateByKey(input.companyId, templateKey);
    if (clash) {
        throw new Error(
            `Conflict: script template key "${templateKey}" already exists for company ${input.companyId}`,
        );
    }

    const sets = await checkSetList(input.companyId, scriptSetIds);

    const template = await customScripts.createTemplate({
        companyId: input.companyId,
        scriptUuid: randomUUID(),
        programKind: input.programKind,
        templateKey,
        templateName: input.templateName,
        templateDescription: input.templateDescription ?? null,
        scriptSetIds,
        updatedBy: input.updatedBy ?? null,
        createdBy: input.createdBy ?? null,
    });

    trace("script", templateKey, "template_created", {
        scriptUuid: template.script_uuid,
        sets: scriptSetIds,
        questions: sets.reduce((total, set) => total + (set.questions ?? []).length, 0),
    });

    return describeTemplate(template);
};

export const listScriptTemplates = async (
    companyId: number,
    programKind?: ProgramKind,
): Promise<IScriptTemplateView[]> => {
    const templates = await customScripts.listTemplates(companyId, programKind);
    return templates.map(describeTemplate);
};

export const getScriptTemplateSet = async (
    scriptUuid: string,
    questionPatternId: number,
): Promise<IScriptTemplateSetView> => {
    const template = await customScripts.findTemplateByUuidGlobal(scriptUuid);
    if (!template) throw new Error(`No script template ${scriptUuid}`);

    const { assignedRoles } = await templateImpact(
        Number(template.company_id),
        Number(template.custom_script_template_id),
    );

    const scriptSetIds = (template.script_set_ids ?? []).map(Number);
    const sets = await customScripts.listSetsByIds( scriptSetIds);
    const matches = sets.filter((row) => Number(row.question_pattern_id) === questionPatternId);
    if (!matches.length) return { script: null, assignedRoles };
    if (matches.length > 1) {
        throw new Error(
            `Conflict: heading ${scriptUuid} gathers ${matches.length} active sets of pattern ` +
            `${questionPatternId} - ${matches.map((row) => row.script_name).join(", ")}`,
        );
    }
    const [set] = matches;

    return { script: { ...describeSet(set), questions: set.questions ?? [] }, assignedRoles };
};

const sameSetList = (left: number[], right: number[]): boolean =>
    left.length === right.length && left.every((setId, index) => setId === right[index]);

/**
 * Refuses a set-list change that would reach someone. A rename is not guarded -
 * only the sets decide what a candidate is asked.
 */
const guardSetListChange = async (
    companyId: number,
    template: CustomScriptTemplate,
    scriptSetIds: number[],
    acknowledgeImpact: boolean,
): Promise<void> => {
    if (sameSetList(scriptSetIds, (template.script_set_ids ?? []).map(Number))) return;

    const { assignedRoles } = await templateImpact(
        companyId,
        Number(template.custom_script_template_id),
    );

    if (assignedRoles.length && !acknowledgeImpact) {
        const codes = assignedRoles.map((role) => role.jobShortCode).join(", ");
        trace("script", template.template_key, "template_edit_needs_ack", { roles: codes });
        throw new Error(
            `Conflict: ${assignedRoles.length} job role(s) already use this heading (${codes}) and will be asked the changed questions - resend with acknowledgeImpact true`,
        );
    }
};


/* -- which role runs which heading ----------------------------------------- */

const describeAssignment = (row: CustomScript): IRoleScriptView => ({
    customScriptId: Number(row.custom_script_id),
    jobShortCode: row.job_short_code,
    jobLabel: row.job_label,
    programKind: row.program_kind,
    participantRole: row.participant_role,
    scriptUuid: row.template?.script_uuid ?? "",
    templateName: row.template?.template_name ?? "",
});

const unassignRoles = async (
    input: IAssignScriptRequest,
    programKind: ProgramKind,
    participantRole: DefaultScriptRole,
    codes: string[],
    transaction: Transaction,
): Promise<IRoleScriptView[]> => {
    const existing = await customScripts.findAssignmentsForRoles(
        { companyId: input.companyId, programKind, participantRole, jobShortCodes: codes },
        transaction,
    );
    if (!existing.length) {
        throw new Error(`No active assignment for job role(s) ${codes.join(", ")} to remove`);
    }

    const removed: IRoleScriptView[] = [];
    for (const row of existing) {
        removed.push(describeAssignment(row));
        await row.update(
            { deleted_ts: new Date(), updated_by: input.updatedBy ?? null },
            { transaction },
        );
        trace("script", row.job_short_code, "unassigned", {
            customScriptId: Number(row.custom_script_id),
        });
    }
    return removed;
};

export const assignScript = async (input: IAssignScriptRequest): Promise<IRoleScriptView[]> => {
    const participantRole = input.participantRole ?? "AGENT";

    const codes = input.jobRoles.map((role) => role.jobShortCode);
    const duplicate = codes.find((code, index) => codes.indexOf(code) !== index);
    if (duplicate) {
        throw new Error(`Conflict: job role "${duplicate}" is listed twice in this request`);
    }

    // One transaction for every role, so a bulk assign never half-applies.
    return connection.transaction(async (transaction) => {
        const template = await customScripts.findTemplateByUuid(
            input.companyId,
            input.scriptUuid,
            transaction,
        );
        if (!template) {
            throw new Error(`No script template ${input.scriptUuid} for company ${input.companyId}`);
        }

        if (input.remove === 1) {
            return unassignRoles(input, template.program_kind, participantRole, codes, transaction);
        }

        if (!template.is_active) {
            throw new Error(`Conflict: script template ${input.scriptUuid} is retired`);
        }
        if (!(template.script_set_ids ?? []).length) {
            throw new Error(
                `Conflict: script template ${input.scriptUuid} is empty - add a question set first`,
            );
        }
        await checkSetList(
            input.companyId,
            (template.script_set_ids ?? []).map(Number),
            transaction,
            Number(template.custom_script_template_id),
        );
        const programKind = template.program_kind;
        const templateId = Number(template.custom_script_template_id);

        const existing = await customScripts.findAssignmentsForRoles(
            { companyId: input.companyId, programKind, participantRole, jobShortCodes: codes },
            transaction,
        );

        if (existing.length) {
            if (input.assign === 0) {
                const names = existing
                    .map((row) => `${row.job_short_code} (currently ${row.template?.template_name ?? row.custom_script_template_id})`)
                    .join(", ");
                throw new Error(
                    `Conflict: job role(s) ${names} already have a script assigned - ` +
                    `resend with assign: 1 to replace ${existing.length > 1 ? "them" : "it"}`,
                );
            }
        }

        const written: IRoleScriptView[] = [];

        for (const role of input.jobRoles) {
            // Locked, or two admins on one role both write a live row.
            const existing = await customScripts.findScriptForRole(
                {
                    companyId: input.companyId,
                    programKind,
                    participantRole,
                    jobShortCode: role.jobShortCode,
                },
                transaction,
                true,
            );

            if (existing) {
                await existing.update(
                    { deleted_ts: new Date(), updated_by: input.updatedBy ?? null },
                    { transaction },
                );
                trace("script", role.jobShortCode, "retired", {
                    customScriptId: Number(existing.custom_script_id),
                    was: Number(existing.custom_script_template_id),
                });
            }

            const row = await CustomScript.create(
                {
                    company_id: input.companyId,
                    custom_script_template_id: templateId,
                    program_kind: programKind,
                    participant_role: participantRole,
                    job_short_code: role.jobShortCode,
                    job_label: role.jobLabel ?? null,
                    updated_by: input.updatedBy ?? null,
                    created_by: input.createdBy ?? null,
                },
                { transaction },
            );

            trace("script", role.jobShortCode, "assigned", {
                customScriptId: Number(row.custom_script_id),
                scriptUuid: template.script_uuid,
            });

            written.push({
                ...describeAssignment(row),
                scriptUuid: template.script_uuid,
                templateName: template.template_name,
            });
        }

        return written;
    });
};

export const listAssignments = async (companyId: number, filter: { jobShortCode?: string; scriptUuid?: string } = {},): Promise<IRoleScriptView[]> => {
    let templateId: number | undefined;
    if (filter.scriptUuid) {
        const template = await customScripts.findTemplateByUuid(companyId, filter.scriptUuid);
        if (!template) throw new Error(`No script template ${filter.scriptUuid} for company ${companyId}`);
        templateId = Number(template.custom_script_template_id);
    }

    const rows = await customScripts.listAssignments(companyId, {
        jobShortCode: filter.jobShortCode,
        templateId,
    });
    return rows.map(describeAssignment);
};

/* -- correcting a set --------------------------------------------------- */

interface IRewriteSetInput {
    scriptId: number;
    scriptName: string;
    updatedBy?: number | null;
}

/** Rewrites scriptId's row directly - only reachable while no heading gathers it. */
const updateSetInPlace = async (
    input: IRewriteSetInput,
    oldSet: CustomScriptSet,
    pattern: QuestionPattern,
    questions: IStoredScriptQuestion[],
    transaction: Transaction,
): Promise<{ script: IScriptSetDetailView }> => {
    // Global: a set carries no company_id, so another company's heading
    // gathering it still means this is not a free-standing set to edit.
    const usedBy = await customScripts.listTemplatesUsingSetGlobal(input.scriptId, transaction);
    if (usedBy.length) {
        const names = usedBy.map((row) => `${row.template_key} (${row.script_uuid})`).join(", ");
        throw new Error(
            `Conflict: script ${input.scriptId} is gathered by heading(s) ${names} - ` +
            `resend with that heading's scriptUuid instead of updating it directly`,
        );
    }

    await oldSet.update(
        {
            question_pattern_id: Number(pattern.question_pattern_id),
            script_name: input.scriptName,
            questions,
            updated_by: input.updatedBy ?? null,
        },
        { transaction },
    );

    trace("script", input.scriptName, "set_updated_in_place", { scriptId: input.scriptId });

    oldSet.pattern = pattern;
    return { script: { ...describeSet(oldSet), questions } };
};

/** Guards a replace: the heading must be live, name this set, and reach at most one role with no live call. */
const assertReplaceable = async (
    input: IUpdateCustomScriptRequest,
    scriptUuid: string,
    template: CustomScriptTemplate,
    transaction: Transaction,
): Promise<void> => {
    if (!template.is_active) {
        throw new Error(`Conflict: script template ${scriptUuid} is already retired`);
    }

    const templateSetIds = (template.script_set_ids ?? []).map(Number);
    if (!templateSetIds.includes(input.scriptId)) {
        throw new Error(
            `Conflict: script ${input.scriptId} is not one of the sets under template ${scriptUuid}`,
        );
    }

    // The uuid names one heading, but nothing stops a second heading gathering
    // the same set id - swapping it here would drop that heading's question.
    const otherTemplates = (
        await customScripts.listTemplatesUsingSetGlobal(input.scriptId, transaction)
    ).filter((row) => Number(row.custom_script_template_id) !== Number(template.custom_script_template_id));
    if (otherTemplates.length) {
        const names = otherTemplates.map((row) => `${row.template_key} (${row.script_uuid})`).join(", ");
        throw new Error(
            `Conflict: script ${input.scriptId} is also gathered by heading(s) ${names} - ` +
            `a set can only be replaced through this flow while a single heading uses it`,
        );
    }

};

/** Moves every role off the retired template onto the new one - any number of roles, unguarded here; use the template edit API to review impact first. */
const reassignRoles = async (
    companyId: number,
    oldTemplateId: number,
    newTemplate: CustomScriptTemplate,
    updatedBy: number | null | undefined,
    createdBy: number | null | undefined,
    transaction: Transaction,
): Promise<IRoleScriptView[]> => {
    const rawAssignments = await customScripts.listAssignments(companyId, { templateId: oldTemplateId });
    const reassignedRoles: IRoleScriptView[] = [];

    for (const row of rawAssignments) {
        await row.update({ deleted_ts: new Date(), updated_by: updatedBy ?? null }, { transaction });

        const replacement = await CustomScript.create(
            {
                company_id: companyId,
                custom_script_template_id: Number(newTemplate.custom_script_template_id),
                program_kind: row.program_kind,
                participant_role: row.participant_role,
                job_short_code: row.job_short_code,
                job_label: row.job_label,
                updated_by: updatedBy ?? null,
                created_by: createdBy ?? null,
            },
            { transaction },
        );

        reassignedRoles.push({
            customScriptId: Number(replacement.custom_script_id),
            jobShortCode: replacement.job_short_code,
            jobLabel: replacement.job_label,
            programKind: replacement.program_kind,
            participantRole: replacement.participant_role,
            scriptUuid: newTemplate.script_uuid,
            templateName: newTemplate.template_name,
        });
    }

    return reassignedRoles;
};

/** Creates a new set and a new heading, retires both old rows, and moves any assigned role across. */
const replaceSet = async (
    input: IUpdateCustomScriptRequest,
    scriptUuid: string,
    oldSet: CustomScriptSet,
    pattern: QuestionPattern,
    questions: IStoredScriptQuestion[],
    transaction: Transaction,
): Promise<IUpdateCustomScriptResponse> => {
    const template = await customScripts.findTemplateByUuid(input.companyId, scriptUuid, transaction, true);
    if (!template) throw new Error(`No script template ${scriptUuid} for company ${input.companyId}`);

    await assertReplaceable(input, scriptUuid, template, transaction);

    const newSet = await customScripts.createSet(
        {
            companyId: input.companyId,
            questionPatternId: Number(pattern.question_pattern_id),
            scriptName: input.scriptName,
            questions,
            updatedBy: input.updatedBy ?? null,
            createdBy: input.createdBy ?? null,
        },
        transaction,
    );

    await oldSet.update(
        { is_active: 0, deleted_ts: new Date(), updated_by: input.updatedBy ?? null },
        { transaction },
    );

    const newSetIds = (template.script_set_ids ?? [])
        .map(Number)
        .map((setId) => (setId === input.scriptId ? Number(newSet.custom_script_set_id) : setId));

    // A sibling set under the same heading could already hold a key this edit
    // just introduced - checked again here because the set list just changed.
    const siblingSets = await customScripts.listSetsByIds(newSetIds, transaction);
    assertKeysUniqueAcrossSets(siblingSets);

    const templateKey = await nextAvailableKey(
        templateKeyRoot(template.template_key),
        async (candidate) =>
            Boolean(await customScripts.findTemplateByKey(input.companyId, candidate, transaction)),
    );

    const newTemplate = await customScripts.createTemplate(
        {
            companyId: input.companyId,
            scriptUuid: randomUUID(),
            programKind: template.program_kind,
            templateKey,
            templateName: template.template_name,
            templateDescription: template.template_description,
            scriptSetIds: newSetIds,
            updatedBy: input.updatedBy ?? null,
            createdBy: input.createdBy ?? null,
        },
        transaction,
    );

    await template.update(
        { is_active: 0, deleted_ts: new Date(), updated_by: input.updatedBy ?? null },
        { transaction },
    );

    const reassignedRoles = await reassignRoles(
        input.companyId,
        Number(template.custom_script_template_id),
        newTemplate,
        input.updatedBy,
        input.createdBy,
        transaction,
    );

    trace("script", input.scriptName, "set_replaced", {
        previousScriptId: input.scriptId,
        scriptId: Number(newSet.custom_script_set_id),
        previousScriptUuid: scriptUuid,
        scriptUuid: newTemplate.script_uuid,
        reassigned: reassignedRoles.length,
    });

    newSet.pattern = pattern;
    return {
        script: { ...describeSet(newSet), questions },
        previousScriptId: input.scriptId,
        previousScriptUuid: scriptUuid,
        scriptUuid: newTemplate.script_uuid,
        reassignedRoles,
    };
};


export const updateCustomScript = async (input: IUpdateCustomScriptRequest): Promise<IUpdateCustomScriptResponse> =>
    connection.transaction(async (transaction) => {
        const pattern = await resolvePattern(input.questionPattern);

        const oldSet = await customScripts.findSet(input.scriptId, transaction, true);
        if (!oldSet) throw new Error(`No script ${input.scriptId}`);
        if (!oldSet.is_active) throw new Error(`Conflict: script ${input.scriptId} is already retired`);

        const questions = fillQuestions(input.questions, pattern);

        return replaceSet(input, input.scriptUuid, oldSet, pattern, questions, transaction);
    });


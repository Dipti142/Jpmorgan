import { z } from "zod";
import { QUESTION_PATTERNS } from "../constants/questionPattern.constants";
import { DefaultScriptPattern } from "../interfaces/IProgram.interface";

const id = z.coerce.number().int().positive();

const key = z.string().trim().min(1).max(50);

const jobShortCode = z.string().trim().min(1).max(50);

const scriptUuid = z.string().trim().uuid();

const patternCodes = QUESTION_PATTERNS.map((pattern) => pattern.pattern_code) as [
    DefaultScriptPattern,
    ...DefaultScriptPattern[],
];

export const questionPattern = z.enum(patternCodes);

const participantRole = z.enum(["ORGANISER", "AGENT"]);

const programKind = z.enum(["INTERVIEW", "ORIENTATION"]);

const scriptType = z.enum(["DEFAULT", "OPTIONAL"]);

const scriptSetIds = z.array(id).max(20);


// Callers send explicit null for "no value" as often as they omit the field - accept both.
const nullableString = (max: number) =>
    z.string().trim().max(max).nullable().optional().transform((value) => value ?? undefined);

const scriptQuestionSchema = z.object({
    question: z.string().trim().min(1).max(4000),
    expectedAnswer: nullableString(4000),
    required: z.coerce.boolean().optional(),
    context: nullableString(4000),
    evaluationGuidance: nullableString(4000),
    ratingRequired: z.coerce.boolean().optional(),
    expected_responses: z
        .record(z.string(), z.string())
        .nullable()
        .optional()
        .transform((value) => value ?? undefined),
    isActive: z.coerce.boolean().optional(),
});

export const createScriptSetSchema = z.object({
    companyId: id,
    scriptId: id.nullable().optional(),
    questionPattern,
    scriptName: z.string().trim().min(1).max(150),
    questions: z.array(scriptQuestionSchema).min(1).max(100),
});

export const createScriptTemplateSchema = z.object({
    programKind: programKind.default("INTERVIEW"),
    templateKey: key.optional(),
    templateName: z.string().trim().min(1).max(150),
    templateDescription: z.string().trim().max(4000).optional(),
    scriptSetIds,
});

export const updateScriptTemplateSchema = z.object({
    companyId: id,
    templateName: z.string().trim().min(1).max(150).optional(),
    templateDescription: z.string().trim().max(4000).nullable().optional(),
    scriptSetIds: scriptSetIds.optional(),
    isActive: z.coerce.number().int().min(0).max(1).optional(),
    acknowledgeImpact: z.coerce.boolean().optional(),
    updatedBy: id.optional(),
});

export const assignScriptSchema = z.object({
    companyId: id,
    scriptUuid,
    participantRole: participantRole.default("AGENT"),
    jobRoles: z
        .array(
            z.object({
                jobShortCode,
                jobLabel: z.string().trim().max(150).optional(),
            }),
        )
        .min(1)
        .max(200),
    assign: z.union([z.literal(0), z.literal(1)]).default(1),
    remove: z.union([z.literal(0), z.literal(1)]).default(0),
});

export const updateCustomScriptSchema = z.object({

    scriptId: id,
    scriptUuid,
    questionPattern,
    scriptName: z.string().trim().min(1).max(150),
    questions: z.array(scriptQuestionSchema).min(1).max(100),
});

export const scriptListQuerySchema = z.object({
    companyId: id,
    questionPattern: questionPattern.optional(),
});

export const templateListQuerySchema = z.object({
    companyId: id,
    programKind: programKind.optional(),
});

export const companyQuerySchema = z.object({
    companyId: id,
});

export const scriptParamsSchema = z.object({
    scriptId: id,
});

export const templateParamsSchema = z.object({
    scriptUuid,
});

export const templateSetQuerySchema = z.object({
    questionPatternId: id,
});

export const assignmentQuerySchema = z.object({
    companyId: id,
    jobShortCode: jobShortCode.optional(),
    scriptUuid: scriptUuid.optional(),
});

export const defaultScriptQuerySchema = z.object({
    companyId: id,
    programKind: programKind.default("INTERVIEW"),
    participantRole: participantRole.default("AGENT"),
    scriptType: scriptType.default("DEFAULT"),
});

import { z } from "zod";

const id = z.coerce.number().int().positive();

const statusCode = z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((value) => value.toUpperCase());

const applicationUuid = z.string().trim().uuid();

export const applicationParamsSchema = z.object({ applicationUuid });

export const applicationQuerySchema = z.object({ companyId: id });

const isValidDateRange = (value: string): boolean => {
    const [start, end, ...extra] = value.split(" - ");
    if (!start || !end || extra.length) return false;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return !Number.isNaN(startTime) && !Number.isNaN(endTime) && startTime <= endTime;
};

const dateRangeParam = z
    .string()
    .trim()
    .max(100)
    .refine(isValidDateRange, { message: "Use 'start - end' with two valid dates, start not after end" });

const applicationFilterFields = {
    companyId: id,
    aiRecommendationStatusId: id.optional(),
    vaMeetingStatusId: id.optional(),
    interviewer: z.string().trim().min(1).max(50).optional(),
    interviewScheduledTs: dateRangeParam.optional(),
    createdTs: dateRangeParam.optional(),
    jobShortCode: z.string().trim().min(1).max(50).optional(),
    escalatedForStaff: z.boolean().optional(),
};

export const listApplicationsBodySchema = z.object({
    ...applicationFilterFields,
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
});

export const exportApplicationsBodySchema = z.object({
    ...applicationFilterFields,
    type: z.enum(["xlsx", "csv"]).optional().default("xlsx"),
});

export const applicationDecisionSchema = z.object({
    companyId: id,
    aiRecommendationStatusId: id,
    reviewerNotes: z.string().trim().max(10000).nullable(),
});

export const registrationEmailSchema = z.object({
    companyId: id,
    aiRecommendationStatusId: id,
    registrationEmailRequested: z.union([z.literal(0), z.literal(1)]),
});

export const reviewApplicationSchema = z
    .object({
        companyId: id,
        reviewerNotes: z.string().trim().max(10000).nullable().optional(),
        overriddenApplicationStatus: statusCode.nullable().optional(),
        escalatedForStaff: z.boolean().optional(),
        updatedUserId: id.optional(),
    })
    .refine(
        (body) =>
            body.reviewerNotes !== undefined ||
            body.overriddenApplicationStatus !== undefined ||
            body.escalatedForStaff !== undefined,
        { message: "Send at least one of reviewerNotes, overriddenApplicationStatus or escalatedForStaff" },
    );

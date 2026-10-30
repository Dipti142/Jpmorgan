import { z } from "zod";

const id = z.coerce.number().int().positive();

export const companyQuerySchema = z.object({
    companyId: id,
});

export const vendorParamsSchema = z.object({
    vendorId: id,
});

export const programQuerySchema = z.object({
    companyId: id,
    jobId: id.optional(),
    jobShortCode: z.string().trim().min(1).max(50).optional(),
    meetingSessionId: id.optional(),
});

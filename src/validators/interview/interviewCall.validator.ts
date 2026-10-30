import { z } from "zod";

/**
 * Input shapes for the call history. Reads are the common case, so the list
 * schema is where the care goes: an unbounded history query over a busy tenant
 * is the easiest accidental denial of service in the service.
 */

/** Positive integer that may arrive as a string, which query params always do. */
const id = z.coerce.number().int().positive();

const CALL_STATUSES = [
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
    "NO_ANSWER",
    "DECLINED",
    "FAILED_TO_JOIN",
    "INTERRUPTED",
    "ABANDONED",
    "CANCELLED",
    "FAILED",
] as const;

export const callListQuerySchema = z.object({
    companyId: id,
    vendorId: id.optional(),
    interviewReference: z.string().trim().min(3).max(30).optional(),
    status: z.enum(CALL_STATUSES).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    // Capped rather than optional-unbounded: a console asking for everything
    // should get a page and a total, not the whole table.
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
});

export const callQuerySchema = z.object({
    companyId: id,
});

export const callParamsSchema = z.object({
    callId: id,
});

/**
 * Written by whatever moves a recording into S3. The bucket and key are
 * separate so a bucket move is an update of one column, not a re-parse.
 */
export const attachRecordingSchema = z.object({
    companyId: id,
    recordingId: z.string().trim().min(1).max(150),
    bucket: z.string().trim().max(150).nullish(),
    key: z.string().trim().max(2000).nullish(),
    status: z.string().trim().max(20).nullish(),
});

import { z } from "zod";

const id = z.coerce.number().int().positive();

const JOIN_MAX_DAYS = 7;

const meetingUrl = z.string().trim().url().max(2000);

const joinAt = z.coerce
    .date()
    .refine(
        (value) => value.getTime() <= Date.now() + JOIN_MAX_DAYS * 24 * 60 * 60 * 1000,
        `joinAt cannot be more than ${JOIN_MAX_DAYS} days ahead`,
    );

export const createMeetingSchema = z.object({
    companyId: id,
    vendorId: id,
    meetingUrl,
    personaKey: z.string().min(1).max(50).optional(),
    avatarKey: z.string().min(1).max(50).optional(),
    jobShortCode: z.string().trim().min(1).max(50).optional(),
    jobId: id.optional(),
    jobLabel: z.string().trim().max(150).optional(),
    joinAt: joinAt.optional(),
    recordSession: z.coerce.boolean().optional().default(false),
    consentVersion: z.string().max(20).optional(),
});

export const meetingParamsSchema = z.object({
    vendorId: id,
});

export const meetingQuerySchema = z.object({
    companyId: id,
});


export const graphNotificationSchema = z.object({
    value: z
        .array(
            z
                .object({
                    clientState: z.string().optional(),
                    subscriptionId: z.string().optional(),
                    resourceData: z.object({ id: z.string().optional() }).passthrough().nullish(),
                    lifecycleEvent: z.string().optional(),
                })
                .passthrough(),
        )
        .default([]),
});

export const validationQuerySchema = z.object({
    validationToken: z.string().min(1).optional(),
});
export const reconcileQuerySchema = z.object({
    companyId: id.optional(),
});

import { z } from "zod";

/** Positive integer that may arrive as a string, which query params always do. */
const id = z.coerce.number().int().positive();

/** base64url, so the character class is narrower than a generic token. */
const inviteToken = z
    .string()
    .trim()
    .min(32)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "ref is not a valid invite token");

/** A meeting is addressed by its uuid, which is 36 characters. */
const sessionReference = z.string().trim().min(1).max(64);

export const sessionParamsSchema = z.object({ sessionReference });

export const sessionQuerySchema = z.object({ companyId: id });

export const listSessionsQuerySchema = z.object({
    companyId: id,
    status: z.enum(["SCHEDULED", "RESCHEDULED", "ACTIVE", "ENDED", "EXPIRED", "REVOKED", "CANCELLED"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const historyQuerySchema = z.object({
    companyId: id,
    outcome: z.enum(["OK", "SKIPPED", "RETRIED", "FAILED"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const endSessionSchema = z.object({
    companyId: id,
    reason: z.string().trim().max(50).optional(),
});

export const extendSessionSchema = z.object({
    companyId: id,
    minutes: z.coerce.number().int().min(1).max(480),
});

export const revokeLinksSchema = z.object({ companyId: id });

export const resetCandidateSessionSchema = z.object({ companyId: id });

export const inviteTokenParamsSchema = z.object({ inviteToken });

/** The token is the whole request: no email, no code, no display name. */
export const joinSchema = z.object({ ref: inviteToken });

export const guestRegistrationSchema = z.object({
    ref: inviteToken,
    email: z.string().trim().toLowerCase().email().max(255),
    displayName: z.string().trim().min(1).max(150),
});

export const MAX_RAW_TRANSCRIPT_EVENTS = 8000;

export const rawTranscriptSchema = z.object({
    ref: inviteToken,
    attemptId: z.string().trim().min(1).max(40),
    events: z
        .array(
            z.object({
                at: z.string().max(40),
                type: z.string().max(64),
                data: z.unknown(),
            }),
        )
        .max(MAX_RAW_TRANSCRIPT_EVENTS),
});

export const MAX_PERSONA_JOIN_LOG_EVENTS = 50;
export const MAX_PERSONA_JOIN_LOG_DETAIL_CHARS = 4000;

export const personaJoinLogSchema = z.object({
    ref: inviteToken,
    events: z
        .array(
            z.object({
                attemptId: z.string().trim().min(1).max(40),
                at: z.string().datetime(),
                level: z.enum(["INFO", "WARN", "ERROR"]),
                stage: z.string().trim().regex(/^[A-Z0-9_]{1,60}$/, "stage must be UPPER_SNAKE_CASE"),
                message: z.string().trim().min(1).max(500),
                detail: z
                    .record(z.string(), z.unknown())
                    .refine(
                        (detail) => JSON.stringify(detail).length <= MAX_PERSONA_JOIN_LOG_DETAIL_CHARS,
                        "detail is too large",
                    )
                    .optional(),
            }),
        )
        .min(1)
        .max(MAX_PERSONA_JOIN_LOG_EVENTS),
});

/** The organizer's own token is the whole credential - their role is re-read from it. */
export const lobbyQuerySchema = z.object({ organiserRef: inviteToken });

export const lobbyParamsSchema = z.object({ sessionReference, participantId: id });

export const decisionSchema = z.object({
    organiserRef: inviteToken,
    decision: z.enum(["ADMIT", "DENY"]),
    reason: z.string().trim().max(200).optional(),
});

export const recordingParamsSchema = z.object({ recordingId: id });

export const transcriptLineParamsSchema = z.object({ inviteToken, lineId: id });

export const transcriptLanguageSchema = z.object({
    ref: inviteToken,
    language: z.string().trim().min(2).max(10).nullable(),
});

export const transcriptionControlSchema = z
    .object({
        ref: inviteToken,
        status: z.enum(["ACTIVE", "PAUSED"]).optional(),
        language: z.string().trim().min(2).max(10).optional(),
    })
    .refine((body) => body.status || body.language, "status or language is required");

/** Seven days is the ceiling a signed link can carry. Omitted means VA_RECORDING_URL_TTL_SECONDS. */
export const signedUrlQuerySchema = z.object({
    companyId: id,
    expiresIn: z.coerce.number().int().min(30).max(604_800).optional(),
});

export const acsEventSchema = z.array(
    z
        .object({
            eventType: z.string().optional(),
            type: z.string().optional(),
            subject: z.string().optional(),
            data: z
                .object({
                    validationCode: z.string().optional(),
                    callConnectionId: z.string().optional(),
                    resultInformation: z.object({ message: z.string().optional() }).passthrough().optional(),
                    recordingStorageInfo: z
                        .object({
                            recordingChunks: z
                                .array(
                                    z
                                        .object({
                                            index: z.coerce.number().int().min(0).optional(),
                                            contentLocation: z.string().optional(),
                                            metadataLocation: z.string().optional(),
                                            deleteLocation: z.string().optional(),
                                        })
                                        .passthrough(),
                                )
                                .optional(),
                        })
                        .passthrough()
                        .optional(),
                })
                .passthrough()
                .optional(),
        })
        .passthrough(),
);

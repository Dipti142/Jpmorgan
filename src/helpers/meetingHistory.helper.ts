import { IHistoryEntryInput, TimelineDraft } from "../interfaces/IMeetingTimeline.interface";
import { maskEmail } from "./speech.helper";

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_KEY_PATTERN = /token|secret|password|authorization|api[-_]?key|link|url|signature/i;
const MAX_TEXT_LENGTH = 500;
const MAX_ERROR_LENGTH = 2000;
const MAX_DEPTH = 4;

const redactText = (value: string, limit: number): string =>
    value
        .replace(BEARER_PATTERN, "Bearer [redacted]")
        .replace(EMAIL_PATTERN, (address) => maskEmail(address))
        .slice(0, limit);

const redactValue = (value: unknown, depth: number): unknown => {
    if (typeof value === "string") return redactText(value, MAX_TEXT_LENGTH);
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Date) return value.toISOString();
    if (depth >= MAX_DEPTH) return "[too deep]";
    if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactValue(item, depth + 1));

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => [key, SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redactValue(item, depth + 1)]),
    );
};

export const redactDetails = (details: Record<string, unknown> | undefined): Record<string, unknown> =>
    (redactValue(details ?? {}, 0) as Record<string, unknown>) ?? {};

export const errorMessageOf = (error: unknown): string =>
    redactText(error instanceof Error ? error.message : String(error), MAX_ERROR_LENGTH);

export const errorCodeOf = (error: unknown): string => {
    if (error === null || typeof error !== "object") return "UNKNOWN";
    const source = error as { code?: unknown; statusCode?: unknown; status?: unknown; name?: unknown };
    const code = source.code ?? source.statusCode ?? source.status ?? source.name;
    return code === undefined || code === null || code === "" ? "UNKNOWN" : String(code).slice(0, 80);
};

const baseDraft = (input: IHistoryEntryInput) => ({
    occurred_ts: new Date().toISOString(),
    track: input.track,
    provider: input.provider,
    event_type: input.eventType,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    actor: input.actor,
    note: input.note,
    message: input.message,
});

const recipientOf = (input: IHistoryEntryInput): Record<string, unknown> =>
    input.recipientEmail ? { recipientEmail: input.recipientEmail } : {};

export const eventDraft = (input: IHistoryEntryInput): TimelineDraft => {
    const outcome = input.outcome ?? "OK";
    const redacted = outcome === "OK" ? {} : redactDetails(input.details);
    return {
        ...baseDraft(input),
        outcome,
        details: { ...redacted, ...recipientOf(input) },
    };
};

export const failureDraft = (input: IHistoryEntryInput, error: unknown): TimelineDraft => ({
    ...baseDraft(input),
    details: { ...redactDetails(input.details), ...recipientOf(input) },
    outcome: "FAILED",
    error_code: input.errorCode ?? errorCodeOf(error),
    error_message: errorMessageOf(error),
});

/**
 * One-line traces, keyed by interview reference.
 *
 * A Teams call has no browser console, so the server log is the only place a
 * call can be followed. Every line carries the reference, so one call greps out
 * of a busy log: `grep "INT-48210" server.log`.
 *
 *   [meeting INT-48210] created inviteId=inv_9f2 displayName="Maya (AI)"
 *   [tool INT-48210] record_answer section=languages outcome=answered
 */

/** A value with a space in it is quoted, or the fields run together unreadably. */
const render = (value: unknown): string => {
    if (typeof value !== "string") return JSON.stringify(value);
    return /\s/.test(value) ? JSON.stringify(value) : value;
};

// false and 0 are kept - "resumed=false" is the interesting case, not noise.
const format = (detail: Record<string, unknown>): string =>
    Object.entries(detail)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => `${key}=${render(value)}`)
        .join(" ");

export const trace = (
    tag: string,
    reference: string,
    event: string,
    detail: Record<string, unknown> = {},
): void => {
    const fields = format(detail);
    console.log(`[${tag} ${reference}] ${event}${fields ? ` ${fields}` : ""}`);
};

/** Failures keep the same shape, so a call reads in order whatever went wrong. */
export const traceFailure = (tag: string, reference: string, event: string, error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${tag} ${reference}] ${event} FAILED: ${message}`);
};

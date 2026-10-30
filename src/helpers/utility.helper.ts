import { Op } from "sequelize";
import moment from 'moment-timezone';

export function formatDateTime(dateInstance: Date): string {
    if (!(dateInstance instanceof Date) || Number.isNaN(dateInstance.getTime())) {
        return "Invalid Date";
    }

    const year = dateInstance.getFullYear();
    const month = dateInstance.getMonth() + 1;
    const day = dateInstance.getDate();
    const hours = dateInstance.getHours();
    const minutes = dateInstance.getMinutes();
    const seconds = dateInstance.getSeconds();

    const formattedDateTime =
        `${year}-${month < 10 ? "0" : ""}${month}-${day < 10 ? "0" : ""}${day} ` +
        `${hours < 10 ? "0" : ""}${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""
        }${seconds}`;

    return formattedDateTime;
}

export function safeJsonStringify(value: any, space?: number): string {
    const seen = new WeakSet();
    return JSON.stringify(
        value,
        (_key, val) => {
            if (typeof val === "bigint") {
                return val.toString();
            }
            if (typeof val === "object" && val !== null) {
                if (seen.has(val)) return "[Circular]";
                seen.add(val);
            }

            return val;
        },
        space
    );
}

export function serializeError(error: any): Record<string, any> {
    if (!error) return {};
    if (typeof error !== "object") {
        return { message: String(error) };
    }
    const serialized: Record<string, any> = {
        name: error.name ?? "Error",
        message: error.message ?? "Unknown error",
        stack: error.stack,
    };
    if ("code" in error) serialized.code = error.code;
    if ("cause" in error) serialized.cause = error.cause;
    if ("errors" in error) serialized.errors = error.errors;
    if ("original" in error) serialized.original = error.original;
    if (error.response) {
        serialized.response = {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers,
        };
    }

    if (error.config) {
        serialized.config = {
            url: error.config.url,
            method: error.config.method,
            baseURL: error.config.baseURL,
            data: error.config.data,
        };
    }
    return serialized;
}

export function extractChildJobs(context: any): any[] {
    const jobs = context?.ChildJobs;
    return Array.isArray(jobs) ? jobs.filter((j: any) => j && typeof j === "object") : [];
}


export function assembleChildScriptContext(childContexts: Array<Record<string, any>>): Record<string, any> {
    const contexts = (childContexts || []).map((c) => c || {});
    const anchor = contexts[0] ?? {};
    return contexts.length > 1 ? { ...anchor, ChildJobs: contexts } : anchor;
}


export function getNextDayStart(): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 1);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

export function getNextDayEnd(): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 1);
    date.setUTCHours(23, 59, 59, 999);
    return date;
}

export const dateRange = (dateRange: any, fieldName: any, whereConditions: any) => {
    if (dateRange) {
        const [startDateStr, endDateStr] = dateRange.split(' - ');
        if (startDateStr && endDateStr) {
            return {
                ...whereConditions,
                [fieldName]: { [Op.between]: [new Date(startDateStr), new Date(endDateStr)] }
            };
        }
    }
    return whereConditions;
};

export const buildExactFilters = (fields: Record<string, unknown>): Record<string, unknown> => {
    const filters: Record<string, unknown> = {};
    Object.entries(fields).forEach(([column, value]) => {
        if (value !== undefined && value !== null) filters[column] = value;
    });
    return filters;
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));


/**
 * Convert a UTC datetime string to user's timezone datetime string
 * @param utcDateStr - UTC datetime string (e.g. "2025-09-30T12:00:00Z")
 * @param userTimeZone - Timezone string (e.g. "America/New_York")
 * @param outputFormat - Optional moment format string, default ISO 8601 without milliseconds
 * @returns formatted date-time string in user's timezone
 */
export const convertUtcToUserTime = (
    utcDateStr: Date,
    userTimeZone: string = "America/New_York",
    outputFormat?: string
) => {
    if (outputFormat) {
        return moment.utc(utcDateStr).tz(userTimeZone).format(outputFormat);
    }
    return moment.utc(utcDateStr).tz(userTimeZone);
}
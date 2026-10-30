import crypto from "node:crypto";
import { Env } from "../config/env.config";

const allowedOrigins = [...(Env.allowed_origins ?? "").split(","), Env.base_url]
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

export const isAllowedOrigin = (origin: string): boolean =>
    (!Env.is_production && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ||
    allowedOrigins.includes(origin.replace(/\/$/, ""));

export const timingSafeMatch = (provided: string, expected: string): boolean => {
    if (!expected) return false;

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

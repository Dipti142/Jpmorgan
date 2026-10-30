import crypto from "node:crypto";
import { Request, Response } from "express";
import { mintToken } from "./meeting.helper";

const DEVICE_COOKIE = "va_device";
const DEVICE_COOKIE_PATH = "/v1/va";
const DEVICE_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const readDeviceKey = (req: Request): string | null => {
    for (const pair of (req.headers.cookie ?? "").split(";")) {
        const [name, ...value] = pair.trim().split("=");
        if (name === DEVICE_COOKIE && value.length) return decodeURIComponent(value.join("="));
    }
    return null;
};

export const ensureDeviceKey = (req: Request, res: Response): string => {
    const key = readDeviceKey(req) ?? mintToken();

    res.cookie(DEVICE_COOKIE, key, {
        httpOnly: true,
        secure: req.secure,
        sameSite: "lax",
        path: DEVICE_COOKIE_PATH,
        maxAge: DEVICE_COOKIE_MAX_AGE_MS,
    });
    return key;
};

export const hashDeviceKey = (key: string): string =>
    crypto.createHash("sha256").update(key).digest("hex");

export const isSameDevice = (storedHash: string, key: string | null): boolean => {
    if (!key) return false;
    const presented = Buffer.from(hashDeviceKey(key), "hex");
    const stored = Buffer.from(storedHash, "hex");
    return presented.length === stored.length && crypto.timingSafeEqual(presented, stored);
};

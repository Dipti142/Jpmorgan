import { NextFunction, Request, Response } from "express";
import { Env } from "../config/env.config";
import { timingSafeMatch } from "../helpers/security.helper";
import { trace } from "../helpers/trace.helper";

/**
 * Guards the public Event Grid endpoint. Event Grid has no dependable custom
 * header for plain webhooks, so the secret rides in the query string as ?code=.
 *
 * No secret configured means the webhook would be wide open - fail closed.
 */
export const acsWebhookSecret = (req: Request, res: Response, next: NextFunction) => {
    const expected = Env.acs.ACS_WEBHOOK_SECRET;
    if (!expected) return res.errorResponse("ACS webhook secret not configured", null, 500);

    const provided = typeof req.query.code === "string" ? req.query.code : "";
    if (!timingSafeMatch(provided, expected)) {
        trace("acs-webhook", "-", "unauthorized", { ip: req.ip });
        return res.errorResponse("Invalid webhook secret", null, 401);
    }
    return next();
};

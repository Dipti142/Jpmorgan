import { NextFunction, Request, Response } from "express";
import { Env } from "../config/env.config";
import { timingSafeMatch } from "../helpers/security.helper";

// Guards the /tools/* webhooks Anam calls back on. Anam sends the shared
// secret in X-Tool-Secret; anything else is rejected before it reaches a
// controller.
export const anamToolSecret = (req: Request, res: Response, next: NextFunction) => {
  const expected = Env.anam.tool_shared_secret;

  // No secret configured means the webhooks would be wide open — fail closed.
  if (!expected) {
    return res.errorResponse("Tool secret not configured", null, 500);
  }

  if (!timingSafeMatch(req.get("X-Tool-Secret") ?? "", expected)) {
    return res.errorResponse("Invalid tool secret", null, 401);
  }

  return next();
};

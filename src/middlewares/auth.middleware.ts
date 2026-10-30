import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { Env } from "../config/env.config";
import { AuthRequest } from "../types/config/request.type";
import { authUserType } from "../types/config/auth.type";

// Verifies the bearer token issued by the user-authentication microservice.
// issuer/audience are checked too, so a valid token minted for a different
// service is not accepted here.
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.get("Authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return res.errorResponse("Authorization token missing", null, 401);
  }

  try {
    const payload = jwt.verify(token, Env.jwt.private_secret, {
      issuer: Env.jwt.issuer,
      audience: Env.jwt.audience,
    }) as authUserType;

    req.user = payload;
    return next();
  } catch (error: any) {
    const message =
      error?.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.errorResponse(message, null, 401);
  }
};

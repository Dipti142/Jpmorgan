import { NextFunction, Request, Response } from "express";
import { CustomResponse } from "../types/config/response.type";
import { isAllowedOrigin } from "../helpers/security.helper";

export const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next();
  }
  // HSTS, nosniff, frameguard, referrer policy and the rest are helmet's in app.ts.
  // Setting them here too only looks like it works - helmet runs after and wins.
  // Next sets its own on /_next/, where no-store would re-download the bundle every load.
  if (!req.path.startsWith("/_next/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next(); // Continue to the next middleware or route handler
};

export const customCors = (req: Request, res: CustomResponse, next: NextFunction) => {
  const origin = req.get("Origin");
  res.setHeader("Vary", "Origin");
  if (!origin) {
    next();
    return;
  }
  if (origin === `${req.protocol}://${req.get("host")}`) {
    next();
    return;
  }
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-API-Version, X-API-Key, ngrok-skip-browser-warning"
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  }
  console.warn("Blocked by CORS policy:", origin);
  res.setHeader("Access-Control-Allow-Origin", "");
  return res.status(403).json({
    status: "failed",
    success: false,
    message: "CORS policy: Origin not allowed",
  });
};

export const middlewareLog = {
  logRequest: (req: any, res: Response, next: any) => {
    const routesToLog = ["/v1/"];
    const isLoggingRequired = routesToLog.some((route) =>
      req.originalUrl.startsWith(route)
    );
    if (!isLoggingRequired) {
      return next(); // Skip logging for routes that are not in the list
    }
    //Logger.ApiLogger(req); // Custom logging logic
    next();
  },
};

import { NextFunction, Request, Response } from "express";
import { CustomRequest } from "../types/config/request.type";
import { Env } from "../config/env.config";
import ServerLog from "../helpers/serverLogs.helper";

const FLAT_RESPONSE_PREFIXES = ["/v1/interview/tools", "/v1/va/join"];

const wrapsPayloadInData = (url: string): boolean =>
  url.startsWith("/v1/") && !FLAT_RESPONSE_PREFIXES.some((prefix) => url.startsWith(prefix));

const defaultError: any = {
  toJSON: () => {
    return {};
  },
};

export const customResponseHandler = (req: CustomRequest, res: Response, next: NextFunction) => {
  req.startTime = Date.now();

  res.successResponse = ( data: any, message: string = "Success", status: number = 200 ) => {
    const envelope = { status: "success", success: true, message };
    const returnData = wrapsPayloadInData(req.originalUrl) ? { ...envelope, data } : { ...envelope, ...data };
    return res.status(status).json(returnData);
  };

  res.validationError = ( errors: { path: (string | number)[]; message: string }[],message: string = "form validation errors", status: number = 403 ) => {
    const errorResponse: Record<string, string> = {};
    errors.forEach((error) => {
      const field = error.path.join(".") || "form";
      errorResponse[field] = error.message;
    });
    return res.status(status).json({
      status: "failed",
      success: false,
      errors: errorResponse,
      message: message,
    });
  };

  res.errorResponse = (message: string = "Internal Server Error", error: any = defaultError, status: number = 500) => {
    let returnData = {  status: "failed", success: false, message};
    if (![400, 401, 403, 404, 409].includes(status)) {
      console.error(error)
      ServerLog.errorLog(req, res, error, returnData, status);
    }
    return res.status(status).json(returnData);
  };

  next();
};

export function routeErrors(err: Error, req: Request, res: Response, next: NextFunction) {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let errorMessage = "Internal Server Error";
  if (Env.node_environment == "development") {
    errorMessage = err.message || "Internal Server Error";
  }
  res.status(statusCode).json({
    status: "failed",
    success: false,
    message: errorMessage,
  });
}

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    status: "failed",
    success: false,
    message: "Route not found",
  });
};

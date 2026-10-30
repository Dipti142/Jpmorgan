import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Response {
    successResponse: (data: any, message?: string, status?: number, query?: string) => void;
    errorResponse: (message?: string, error?: any, status?: number) => void;
    validationError: (errors: any[], message?: string, status?: number) => void;
    // microserviceErrorResponse: (data: any, status?: number) => void;
  }
}
 
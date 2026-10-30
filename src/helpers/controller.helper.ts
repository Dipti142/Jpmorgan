import { NextFunction, Request, Response } from "express";
import { output, ZodError, ZodTypeAny } from "zod";

type Handler = (req: Request, res: Response) => Promise<unknown>;

export const statusFor = (message: string): number => {
    if (/(?:^No )|(?:not found)|(?:has no )/i.test(message)) return 404;
    if (/^Conflict: /i.test(message)) return 409;
    if (/^Unavailable: /i.test(message)) return 503;
    return 500;
};

export const handle = (handler: Handler) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        await handler(req, res);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.validationError(
                error.issues.map((issue) => ({ path: issue.path as (string | number)[], message: issue.message })),
            );
        }
        const message = error instanceof Error ? error.message : "Unexpected error";
        // The prefix routes the status; the reader should not see it.
        return res.errorResponse(message.replace(/^(?:Conflict|Unavailable): /i, ""), error, statusFor(message));
    }
    return undefined;
};

export const validate = <S extends ZodTypeAny>(schema: S, value: unknown): output<S> =>
    schema.parse(value) as output<S>;

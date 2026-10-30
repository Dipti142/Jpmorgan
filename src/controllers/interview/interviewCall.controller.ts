import { Request, Response } from "express";
import { handle, validate } from "../../helpers/controller.helper";
import * as service from "../../services/interview/interviewCall.service";
import { sessionParamsSchema, sessionQuerySchema } from "../../validators/virtualAvatar.validator";

/** The answer sheet, read by the session it was recorded in. */

export class InterviewCallController {
    public static readonly getSessionAnswers = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(sessionQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        return res.successResponse(await service.getSessionAnswers(companyId, sessionReference));
    });

    public static readonly getSessionEscalations = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(sessionQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        return res.successResponse(await service.getSessionEscalations(companyId, sessionReference));
    });

    public static readonly getSessionEvaluation = handle(async (req: Request, res: Response) => {
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        return res.successResponse(await service.getSessionEvaluation(sessionReference));
    });
}

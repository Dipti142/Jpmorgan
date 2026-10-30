import { Request, Response } from "express";
import { handle } from "../../helpers/controller.helper";
import * as vaMeetingStatus from "../../services/meeting/vaMeetingStatus.service";

export class VaStatusController {
    public static readonly getStatuses = handle(async (_req: Request, res: Response) => {
        const statuses = await vaMeetingStatus.listStatuses();
        return res.successResponse({ statuses });
    });

    public static readonly getAiRecommendationStatuses = handle(async (_req: Request, res: Response) => {
        const statuses = await vaMeetingStatus.listAiRecommendationStatuses();
        return res.successResponse({ statuses });
    });
}

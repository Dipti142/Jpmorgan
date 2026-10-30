import { Request, Response } from "express";
import { handle, validate } from "../../helpers/controller.helper";
import * as timeline from "../../services/meeting/meetingTimeline.service";
import { historyQuerySchema, sessionParamsSchema } from "../../validators/virtualAvatar.validator";

export class MeetingHistoryController {
    public static readonly getHistory = handle(async (req: Request, res: Response) => {
        const { companyId, ...query } = validate(historyQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const history = await timeline.getMeetingHistory(companyId, sessionReference, query);

        return res.successResponse(history);
    });
}

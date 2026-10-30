import { Request, Response } from "express";
import { handle, validate } from "../../helpers/controller.helper";
import * as transcript from "../../services/meeting/meetingTranscript.service";
import { sessionParamsSchema, sessionQuerySchema } from "../../validators/virtualAvatar.validator";

export class MeetingTranscriptController {
    public static readonly getTranscript = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(sessionQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const result = await transcript.getMeetingTranscript(companyId, sessionReference);

        return res.successResponse(result);
    });
}

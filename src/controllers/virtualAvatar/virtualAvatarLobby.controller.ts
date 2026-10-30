import { Request, Response } from "express";
import { handle, validate } from "../../helpers/controller.helper";
import * as meetingJoin from "../../services/meeting/meetingJoin.service";
import {
    decisionSchema,
    lobbyParamsSchema,
    lobbyQuerySchema,
    sessionParamsSchema,
} from "../../validators/virtualAvatar.validator";

export class VirtualAvatarLobbyController {
    public static readonly getLobby = handle(async (req: Request, res: Response) => {
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const { organiserRef } = validate(lobbyQuerySchema, req.query);

        const waiting = await meetingJoin.listLobby(sessionReference, organiserRef);

        return res.successResponse({ waiting });
    });

    public static readonly postDecision = handle(async (req: Request, res: Response) => {
        const { sessionReference, participantId } = validate(lobbyParamsSchema, req.params);
        const { organiserRef, decision, reason } = validate(decisionSchema, req.body);

        const result = await meetingJoin.decideAdmission({
            sessionReference,
            participantId,
            organiserRef,
            decision,
            reason,
        });

        return res.successResponse(result, `Request ${result.decision.toLowerCase()}`);
    });
}

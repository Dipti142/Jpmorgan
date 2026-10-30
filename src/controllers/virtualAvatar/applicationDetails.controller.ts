import { Request, Response } from "express";
import { handle, validate } from "../../helpers/controller.helper";
import { VaScheduleStatus } from "../../interfaces/IMeeting.interface";
import * as applications from "../../services/meeting/applicationDetails.service";
import { applicationDecisionSchema, applicationParamsSchema, applicationQuerySchema, exportApplicationsBodySchema, listApplicationsBodySchema, registrationEmailSchema, reviewApplicationSchema } from "../../validators/applicationDetails.validator";
import { exportData } from "../../services/exportService.service";
import { AuthRequest } from "../../types/config/request.type";

export class ApplicationDetailsController {
    public static readonly getApplications = handle(async (req: Request, res: Response) => {
        const filter = validate(listApplicationsBodySchema, req.body);
        const result = await applications.listApplications(filter);
        return res.successResponse(result);
    });

    public static readonly exportApplications = handle(async (req: Request, res: Response) => {
        const { type, ...filter } = validate(exportApplicationsBodySchema, req.body);
        const { rows, headings } = await applications.buildApplicationExport(filter);
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
        await exportData(res, type, rows, headings, "Applications", `Applications and Interviews.${type}`);
    });

    public static readonly getApplication = handle(async (req: Request, res: Response) => {
        const { applicationUuid } = validate(applicationParamsSchema, req.params);
        const { companyId } = validate(applicationQuerySchema, req.query);
        const application = await applications.getApplication(companyId, applicationUuid);
        return res.successResponse({ application });
    });

    public static readonly putDecision = handle(async (req: AuthRequest, res: Response) => {
        const { applicationUuid } = validate(applicationParamsSchema, req.params);
        const { companyId, ...decision } = validate(applicationDecisionSchema, req.body);
        const updatedUserId = Number(req.user?.userID);
        if (!Number.isInteger(updatedUserId) || updatedUserId <= 0) {
            return res.errorResponse("Token has no user id", null, 401);
        }
        const application = await applications.recordDecision(companyId, applicationUuid, {
            ...decision,
            updatedUserId,
        });
        return res.successResponse({ application }, "Decision saved");
    });

    public static readonly postRegistrationEmail = handle(async (req: AuthRequest, res: Response) => {
        const { applicationUuid } = validate(applicationParamsSchema, req.params);
        const { companyId, ...request } = validate(registrationEmailSchema, req.body);
        const updatedUserId = Number(req.user?.userID);
        if (!Number.isInteger(updatedUserId) || updatedUserId <= 0) {
            return res.errorResponse("Token has no user id", null, 401);
        }
        const { application, attempted } = await applications.requestRegistrationEmail(companyId, applicationUuid, {
            ...request,
            updatedUserId,
        });
        return res.successResponse(
            { application },
            attempted ? "Registration email processed" : "No registration email sent",
        );
    });

    public static readonly patchApplication = handle(async (req: Request, res: Response) => {
        const { applicationUuid } = validate(applicationParamsSchema, req.params);
        const { companyId, ...review } = validate(reviewApplicationSchema, req.body);
        const overriddenApplicationStatus = review.overriddenApplicationStatus as VaScheduleStatus | null | undefined;

        const application = await applications.reviewApplication(companyId, applicationUuid, {
            ...review,
            overriddenApplicationStatus,
        });

        return res.successResponse({ application }, "Application updated");
    });
}

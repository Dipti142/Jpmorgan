import { Request, Response } from "express";
import { handle, validate } from "../helpers/controller.helper";
import * as service from "../services/customScript.service";
import { AuthRequest } from "../types/config/request.type";
import {
    assignScriptSchema,
    assignmentQuerySchema,
    companyQuerySchema,
    createScriptSetSchema,
    createScriptTemplateSchema,
    defaultScriptQuerySchema,
    scriptListQuerySchema,
    scriptParamsSchema,
    templateListQuerySchema,
    templateParamsSchema,
    templateSetQuerySchema,
    updateCustomScriptSchema
} from "../validators/customScript.validator";

export class CustomScriptController {
    public static readonly postScript = handle(async (req: AuthRequest, res: Response) => {
        const body = validate(createScriptSetSchema, req.body);
        const updatedBy = req.user.userID;
        const script = await service.createScriptSet({ ...body, updatedBy, createdBy: updatedBy });
        const message = body.scriptId ? "Question set updated successfully." : "Question set created successfully.";
        return res.successResponse({ script }, message);
    });

    public static readonly postTemplate = handle(async (req: AuthRequest, res: Response) => {
        const body = validate(createScriptTemplateSchema, req.body);
        const companyId = req.user.companyID;
        const userId = req.user.userID;
        const template = await service.createScriptTemplate({
            ...body,
            companyId,
            updatedBy: userId,
            createdBy: userId,
        });
        return res.successResponse({ template }, "Script heading created successfully.");
    });

    public static readonly postUpdateScript = handle(async (req: AuthRequest, res: Response) => {
        const body = validate(updateCustomScriptSchema, req.body);
        const companyId = req.user.companyID;
        const userId = req.user.userID;
        const result = await service.updateCustomScript({
            ...body,
            companyId,
            updatedBy: userId,
            createdBy: userId,
        });
        return res.successResponse({ ...result }, "Question set replaced and heading updated successfully.");
    });

    public static readonly postAssign = handle(async (req: AuthRequest, res: Response) => {
        const body = validate(assignScriptSchema, req.body);
        const userId = req.user.userID;
        const assigned = await service.assignScript({ ...body, updatedBy: userId, createdBy: userId });
        const message = body.remove === 1 ? "Script unassigned successfully." : "Script assigned successfully.";
        return res.successResponse({ assigned }, message);
    });

    public static readonly getScripts = handle(async (req: Request, res: Response) => {
        const { companyId, questionPattern } = validate(scriptListQuerySchema, req.query);
        const scripts = await service.listScriptSets(companyId, questionPattern);
        return res.successResponse({ scripts }, "Question sets fetched successfully.");
    });

    public static readonly getScript = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(companyQuerySchema, req.query);
        const { scriptId } = validate(scriptParamsSchema, req.params);
        const script = await service.getScriptSet(companyId, scriptId);
        return res.successResponse({ script }, "Question set fetched successfully.");
    });

    public static readonly getTemplates = handle(async (req: Request, res: Response) => {
        const { companyId, programKind } = validate(templateListQuerySchema, req.query);
        const templates = await service.listScriptTemplates(companyId, programKind);
        return res.successResponse({ templates }, "Script headings fetched successfully.");
    });

    public static readonly getTemplate = handle(async (req: Request, res: Response) => {
        const { scriptUuid } = validate(templateParamsSchema, req.params);
        const { questionPatternId } = validate(templateSetQuerySchema, req.query);
        const { script, assignedRoles } = await service.getScriptTemplateSet(scriptUuid, questionPatternId);

        let message = "Question set fetched successfully.";
        if (!script) {
            message = `No active question set for pattern ${questionPatternId} under heading ${scriptUuid}.`;
        } else if (assignedRoles.length > 1) {
            message = `${assignedRoles.length} job role(s) already use this script - updating it will change what they are asked. Add a new question set instead if you want to leave them unaffected.`;
        }

        return res.successResponse({ script, assignedRoles }, message);
    });

    public static readonly getAssignments = handle(async (req: Request, res: Response) => {
        const { companyId, jobShortCode, scriptUuid } = validate(assignmentQuerySchema, req.query);
        const assignments = await service.listAssignments(companyId, { jobShortCode, scriptUuid });
        return res.successResponse({ assignments }, "Assignments fetched successfully.");
    });

    public static readonly getPatterns = handle(async (req: Request, res: Response) => {
        const patterns = await service.listActivePatterns();
        return res.successResponse({ patterns }, "Question patterns fetched successfully.");
    });

    public static readonly getDefaultScript = handle(async (req: Request, res: Response) => {
        const query = validate(defaultScriptQuerySchema, req.query);
        const sets = await service.listDefaultScript(query);
        return res.successResponse({ sets }, "Default script fetched successfully.");
    });
}

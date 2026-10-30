import { Request, Response } from "express";
import { Env } from "../../config/env.config";
import { describeAnamReadiness, describeKnowledgeGroup } from "../../services/anamSession.service";
import { handle, validate } from "../../helpers/controller.helper";
import { listPersonas, resolvePersona } from "../../services/persona.service";
import AnamTool from "../../models/anamTool.model";
import * as service from "../../services/interview/interview.service";
import { INTERVIEW_TOOL_BLUEPRINTS, INTERVIEW_TOOL_KEYS } from "../../constants/interview/interview.tools";
import { companyQuerySchema, programQuerySchema } from "../../validators/interview/interview.validator";
import { buildSystemPrompt } from "../../services/prompt.service";
import { ScriptBuilderService } from "../../services/scriptBuilder.service";
import { INTERVIEWER_CUES } from "../../constants/interview/interview.script";
import { VA_CONDUCT, VA_TOOL_CALLING_RULES, VA_TOOL_USE } from "../../constants/virtualAvatar.text";


export class InterviewController {
    public static readonly getPersonas = handle(async (req: Request, res: Response) => {
        const companyId = Number(req.query.companyId) || undefined;
        const personas = await listPersonas({ companyId, programKind: "INTERVIEW" });
        return res.successResponse({ personas });
    });

    public static readonly getProgram = handle(async (req: Request, res: Response) => {
        const { companyId, jobId, jobShortCode, meetingSessionId } = validate(programQuerySchema, req.query);
        const program = await service.getProgramOutline(companyId, jobId, jobShortCode, meetingSessionId);

        return res.successResponse(program);
    });

    public static readonly getProgramScript = handle(async (req: Request, res: Response) => {
        const { companyId, jobShortCode, meetingSessionId } = validate(programQuerySchema, req.query);
        const script = await service.getProgramScript(companyId, jobShortCode, meetingSessionId);

        return res.successResponse(script);
    });

    public static readonly getConfig = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(companyQuerySchema, req.query);
        const personaKey = typeof req.query.personaKey === "string" ? req.query.personaKey : undefined;

        const { persona, program, company } = await resolvePersona(companyId, personaKey, "INTERVIEW");
        const readiness = describeAnamReadiness();

        const provisioned = await AnamTool.findAll({
            where: { company_id: companyId, is_active: 1 },
        });
        const provisionedKeys = new Set(provisioned.map((tool) => tool.tool_key));

        const knowledge = await describeKnowledgeGroup();

        // The prompt as a session actually assembles it, so its shape and size can be read off one response.
        const preview = Env.is_production ? undefined : await (async () => {
            const { sets } = await ScriptBuilderService.resolve({ companyId, programKind: "INTERVIEW" });
            const script = ScriptBuilderService.renderOpening(sets, { rejoining: false, closing: service.CLOSING_BLOCKS });
            return buildSystemPrompt({
                characterPrompt: persona.characterPrompt,
                personaName: "[agent_name]",
                companyName: company.company_name,
                subjectBrief: "You are on a video call with 1 other participants. " +
                    "This interview's reference is [reference] - you need it for everything you record.",
                roomConduct: VA_CONDUCT,
                script,
                toolUse: VA_TOOL_USE,
                toolCallingRules: VA_TOOL_CALLING_RULES,
                directorNotes: INTERVIEWER_CUES,
            });
        })();

        // console.log("Sytem prompt", preview)

        const config = {
            ready: readiness.ready && INTERVIEW_TOOL_KEYS.every((key) => provisionedKeys.has(key)),
            missing: readiness.missing,
            provisioned: INTERVIEW_TOOL_KEYS.every((key) => provisionedKeys.has(key)),
            company: {
                id: Number(company.company_id),
                key: company.company_key,
                name: company.company_name,
                toolPrefix: company.tool_prefix,
            },
            personaKey: persona.personaKey,
            personaRole: persona.personaRole,
            personaKind: program.program_kind,
            presetStyles: persona.presetStyles ?? [],
            directorNotes: persona.directorNotes ?? {},
            publicBaseUrl: Env.anam.public_base_url,
            knowledge,
            tools: INTERVIEW_TOOL_BLUEPRINTS.map((blueprint) => ({
                key: blueprint.key,
                kind: blueprint.kind,
                name: provisioned.find((tool) => tool.tool_key === blueprint.key)?.tool_name ?? `${company.tool_prefix}${blueprint.key}`,
                provisioned: provisionedKeys.has(blueprint.key),
                detail: blueprint.path,
            })),
            systemPrompt: preview,
        };

        return res.successResponse(config);
    });
}

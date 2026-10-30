import { Request, Response } from "express";
import { handle, validate } from "../helpers/controller.helper";
import { trace, traceFailure } from "../helpers/trace.helper";
import { IWorkableWebhook } from "../interfaces/IWorkable.interface";
import * as candidate from "../services/workable/candidate.service";
import * as jobs from "../services/workable/job.service";
import { jobsQuerySchema } from "../validators/workable.validator";

export class WorkableController {
    public static readonly getJobs = handle(async (req: Request, res: Response) => {
        const request = validate(jobsQuerySchema, req.query);
        const result = await jobs.listJobs(request);

        return res.successResponse(result);
    });

    public static async candidateCreated(req: Request, res: Response) {
        const webhook = req.body as IWorkableWebhook;
        try {
            trace("workable", webhook?.id ?? "-", "candidate_created", { firedAt: webhook?.fired_at });
            await candidate.recordCandidateCreated(webhook);
            return res.status(200).json({ message: "Webhook received" });
        } catch (error) {
            traceFailure("workable", webhook?.id ?? "-", "candidate_created", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    public static async candidateDeleted(req: Request, res: Response) {
        const webhook = req.body as IWorkableWebhook;
        try {
            trace("workable", webhook?.id ?? "-", "candidate_deleted", { firedAt: webhook?.fired_at });
            return res.status(200).json({ message: "Webhook received" });
        } catch (error) {
            traceFailure("workable", webhook?.id ?? "-", "candidate_deleted", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    public static async candidateMoved(req: Request, res: Response) {
        const webhook = req.body as IWorkableWebhook;
        try {
            trace("workable", webhook?.id ?? "-", "candidate_moved", { firedAt: webhook?.fired_at });
            await candidate.recordCandidateMoved(webhook);
            return res.status(200).json({ message: "Webhook received" });
        } catch (error) {
            traceFailure("workable", webhook?.id ?? "-", "candidate_moved", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
}

import { Router } from "express";
import { WorkableController } from "../controllers/workable.controller";

export const workableRouter = Router();

/**
 * @openapi
 * /v1/workable/jobs:
 *   get:
 *     tags: [Workable]
 *     summary: List jobs from Workable
 *     description: >
 *       Each job carries activeTemplate - the heading currently assigned to
 *       its shortcode for an INTERVIEW AGENT script, or null if none is.
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: state
 *         schema: { type: string, enum: [draft, published, archived, closed], default: published }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 25 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200:
 *         description: Jobs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkableJobListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
workableRouter.get("/jobs", WorkableController.getJobs);

/**
 * @openapi
 * /v1/workable/candidate-created:
 *   post:
 *     tags: [Workable]
 *     summary: A candidate was created in Workable
 *     description: >
 *       Called by Workable, never by a client. Unauthenticated and unvalidated
 *       today - see Known gaps in the README.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkableWebhook'
 *     responses:
 *       200:
 *         description: Received
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkableAck'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
workableRouter.post("/candidate-created", WorkableController.candidateCreated);

/**
 * @openapi
 * /v1/workable/candidate-deleted:
 *   post:
 *     tags: [Workable]
 *     summary: A candidate was deleted in Workable
 *     description: Logged only - nothing is removed on this side yet.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkableWebhook'
 *     responses:
 *       200:
 *         description: Received
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkableAck'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
workableRouter.post("/candidate-deleted", WorkableController.candidateDeleted);

/**
 * @openapi
 * /v1/workable/candidate-moved:
 *   post:
 *     tags: [Workable]
 *     summary: A candidate moved stage in Workable
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkableWebhook'
 *     responses:
 *       200:
 *         description: Received
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkableAck'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
workableRouter.post("/candidate-moved", WorkableController.candidateMoved);

export default workableRouter;

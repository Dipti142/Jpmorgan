import { Router } from "express";
import { TeamsController } from "../controllers/teams.controller";

export const teamsRouter = Router();

/**
 * @openapi
 * /v1/teams/mail/notifications:
 *   post:
 *     tags: [Teams]
 *     summary: Microsoft Graph change notifications for the agent mailbox
 *     description: >
 *       Called by Graph, never by a client. Serves two purposes on one URL:
 *       with a validationToken query param it is the ownership handshake and
 *       echoes the token back as text/plain; otherwise it is a batch of new-mail
 *       notifications. Notifications whose clientState does not match are
 *       ignored. Answers 202 immediately and fetches the messages after, because
 *       Graph retries anything slower than a few seconds.
 *     parameters:
 *       - in: query
 *         name: validationToken
 *         schema: { type: string }
 *         description: Present only on the handshake request.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GraphNotification'
 *     responses:
 *       200:
 *         description: Handshake echo, as text/plain
 *         content:
 *           text/plain:
 *             schema: { type: string }
 *       202:
 *         description: Accepted; messages are fetched and logged after the response
 */
teamsRouter.post("/mail/notifications", TeamsController.postMailNotification);

/**
 * @openapi
 * /v1/teams/mail/lifecycle:
 *   post:
 *     tags: [Teams]
 *     summary: Microsoft Graph subscription lifecycle events
 *     description: >
 *       The separate URL Graph requires for subscription health, and the same
 *       handshake as the notifications endpoint. subscriptionRemoved and missed
 *       both rebuild the subscription - missed means Graph dropped notifications
 *       it could not deliver, so the inbox and this service have diverged.
 *       reauthorizationRequired is re-consented in place, falling back to a
 *       rebuild.
 *     parameters:
 *       - in: query
 *         name: validationToken
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GraphNotification'
 *     responses:
 *       200:
 *         description: Handshake echo, as text/plain
 *         content:
 *           text/plain:
 *             schema: { type: string }
 *       202:
 *         description: Accepted
 */
teamsRouter.post("/mail/lifecycle", TeamsController.postMailLifecycle);

export default teamsRouter;

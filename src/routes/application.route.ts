import { Router } from "express";
import { ApplicationDetailsController } from "../controllers/virtualAvatar/applicationDetails.controller";
import { authenticate } from "../middlewares/auth.middleware";

export const applicationRouter = Router();

applicationRouter.use(authenticate);

/**
 * @openapi
 * /v1/applications:
 *   post:
 *     tags: [Application and Interview]
 *     summary: Every application with an interview, for the admin tracker
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       One row per scheduled interview, newest interview first. The candidate's
 *       email comes back masked; the phone number comes back as stored. Filters
 *       are sent in the JSON body and combine with AND.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyId]
 *             properties:
 *               companyId: { type: integer, minimum: 1 }
 *               aiRecommendationStatusId:
 *                 type: integer
 *                 minimum: 1
 *                 description: A tl_ai_recommendation_status primary key, matched against the recorded decision.
 *               vaMeetingStatusId:
 *                 type: integer
 *                 minimum: 1
 *                 description: A tl_va_meeting_status primary key, matched against the system status.
 *               interviewer: { type: string, minLength: 1, maxLength: 50, example: AI }
 *               interviewScheduledTs:
 *                 type: string
 *                 maxLength: 100
 *                 description: >
 *                   Date range as 'start - end', both ends included, start not after end.
 *                   A date-only end covers that whole day (to 23:59:59.999 UTC); give a
 *                   time, such as '2026-10-31 12:00:00', to stop earlier.
 *                 example: "2026-10-01 - 2026-10-31"
 *               createdTs:
 *                 type: string
 *                 maxLength: 100
 *                 description: >
 *                   Date range as 'start - end', both ends included, start not after end.
 *                   A date-only end covers that whole day (to 23:59:59.999 UTC); give a
 *                   time, such as '2026-10-31 12:00:00', to stop earlier.
 *                 example: "2026-10-01 - 2026-10-31"
 *               jobShortCode: { type: string, minLength: 1, maxLength: 50 }
 *               escalatedForStaff: { type: boolean }
 *               limit: { type: integer, minimum: 1, maximum: 100, default: 25 }
 *               offset: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200:
 *         description: Applications and the total across all pages
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplicationListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
applicationRouter.post("/", ApplicationDetailsController.getApplications);

/**
 * @openapi
 * /v1/applications/export:
 *   post:
 *     tags: [Application and Interview]
 *     summary: Download the filtered applications as an Excel or CSV file
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Takes the same filters as the list, without limit and offset, plus an optional
 *       type (xlsx or csv). Newest first. No match gives 404. The file holds at most 50,000 rows; if more match, the
 *       answer is 409 and the filters must be narrowed. Free-text cells that start with
 *       =, +, - or @ get a leading apostrophe so a spreadsheet does not run them as formulas.
 *       Email comes back as stored in the list; phone comes back as stored.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyId]
 *             properties:
 *               companyId: { type: integer, minimum: 1 }
 *               aiRecommendationStatusId: { type: integer, minimum: 1 }
 *               vaMeetingStatusId: { type: integer, minimum: 1 }
 *               interviewer: { type: string, minLength: 1, maxLength: 50 }
 *               interviewScheduledTs: { type: string, maxLength: 100, example: "2026-10-01 - 2026-10-31" }
 *               createdTs: { type: string, maxLength: 100, example: "2026-10-01 - 2026-10-31" }
 *               jobShortCode: { type: string, minLength: 1, maxLength: 50 }
 *               escalatedForStaff: { type: boolean }
 *               type: { type: string, enum: [xlsx, csv], default: xlsx }
 *     responses:
 *       200:
 *         description: The file, as an attachment
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *           text/csv:
 *             schema: { type: string }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
applicationRouter.post("/export", ApplicationDetailsController.exportApplications);

/**
 * @openapi
 * /v1/applications/{applicationUuid}:
 *   get:
 *     tags: [Application and Interview]
 *     summary: One application
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The application
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplicationResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Application and Interview]
 *     summary: Record a reviewer's decision on an application
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Only the reviewer's fields can be changed - notes, an override of the
 *       status, and the staff escalation flag. At least one must be sent. The
 *       system status is never overwritten: an override sits beside it. Send
 *       overriddenApplicationStatus as null to remove an override. Each save
 *       replaces the previous value; no history of earlier notes is kept.
 *     parameters:
 *       - in: path
 *         name: applicationUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewApplicationRequest'
 *     responses:
 *       200:
 *         description: The application after the change
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplicationResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
applicationRouter.get("/:applicationUuid", ApplicationDetailsController.getApplication);
applicationRouter.patch("/:applicationUuid", ApplicationDetailsController.patchApplication);

/**
 * @openapi
 * /v1/applications/{applicationUuid}/decision:
 *   put:
 *     tags: [Application and Interview]
 *     summary: Record the decision (passed, failed or on hold) on an application
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Send the id of a row in tl_ai_recommendation_status plus the reviewer's
 *       notes. The id is stored, the status label for that id is copied into
 *       overriddenApplicationStatus, and the notes replace reviewerNotes. The
 *       user who made the change is taken from the token (userID), never the
 *       body. Sending
 *       it again replaces the earlier decision in those fields, and each call
 *       adds an entry to decisionHistory. An id that
 *       does not exist or is inactive gives 409.
 *     parameters:
 *       - in: path
 *         name: applicationUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplicationDecisionRequest'
 *     responses:
 *       200:
 *         description: The application after the decision
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplicationResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
applicationRouter.put("/:applicationUuid/decision", ApplicationDetailsController.putDecision);

/**
 * @openapi
 * /v1/applications/{applicationUuid}/registration-email:
 *   post:
 *     tags: [Application and Interview]
 *     summary: Email the candidate their registration link after a pass
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Optional second step after the decision is saved. Sends the registration
 *       email only when aiRecommendationStatusId is the Passed status AND
 *       registrationEmailRequested is 1; anything else sends nothing and changes
 *       nothing. The recorded decision on the application must also be Passed,
 *       otherwise 409. On a send, registrationEmailRequested becomes 1 and
 *       registrationEmailStatus becomes LINK_SENT or EMAIL_FAILED; either way the
 *       call answers 200, so read registrationEmailStatus. A candidate already at
 *       LINK_SENT is not emailed twice. Calling again after EMAIL_FAILED retries.
 *       The user is taken from the token (userID).
 *     parameters:
 *       - in: path
 *         name: applicationUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegistrationEmailRequest'
 *     responses:
 *       200:
 *         description: The application after the attempt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplicationResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
applicationRouter.post("/:applicationUuid/registration-email", ApplicationDetailsController.postRegistrationEmail);

export default applicationRouter;

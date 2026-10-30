import { Router } from "express";
import { CustomScriptController } from "../controllers/customScript.controller";
import { authenticate } from "../middlewares/auth.middleware";

export const customScriptRouter = Router();

// Required so req.user is populated - POST /update reads companyId from it, not the body.
customScriptRouter.use(authenticate);

/**
 * @openapi
 * /v1/scripts:
 *   post:
 *     tags: [Scripts]
 *     summary: Create a question set
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       One set of one pattern. An author writes the question and what a good
 *       answer covers; key, title, kind, order and the tool are derived.
 *
 *       Send `scriptId` to revise that set in place instead of writing a new
 *       one - refused with 409 if any heading already gathers it, since that
 *       set is no longer this endpoint's to rewrite (correct it through
 *       `POST /v1/scripts/update` instead, which knows how to move the
 *       heading across). Left out or `null` always creates a new row.
 *
 *       `updatedBy` is not sent - it is read off the caller's verified JWT,
 *       same as `POST /v1/scripts/update`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateScriptSetRequest'
 *     responses:
 *       200:
 *         description: Created, or updated in place when scriptId was sent - the full set, questions included
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScriptSetDetailResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
customScriptRouter.post("/", CustomScriptController.postScript);

/**
 * @openapi
 * /v1/scripts/templates:
 *   post:
 *     tags: [Scripts]
 *     summary: Create a heading over a group of sets
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       The heading is what a job role is pointed at. It gathers the sets named
 *       in scriptSetIds - typically one checklist, one question-and-answer set
 *       and one scenario - and returns the scriptUuid used everywhere after.
 *       Every set is checked to exist, and their question keys are checked not
 *       to collide, because record_answer finds a question by key alone.
 *
 *       scriptSetIds may be empty, so a heading can be named first and filled
 *       afterwards with PUT. An empty heading cannot be assigned to a job role.
 *
 *       companyId is not sent - it is read off the caller's verified JWT, so a
 *       heading always belongs to the caller's own company.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateScriptTemplateRequest'
 *     responses:
 *       200:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScriptTemplateResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
customScriptRouter.post("/templates", CustomScriptController.postTemplate);

/**
 * @openapi
 * /v1/scripts/templates:
 *   get:
 *     tags: [Scripts]
 *     summary: The company's headings
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Every active heading for the company - the catalogue a scriptUuid is
 *       picked from. Narrow by programKind; omit it for every kind.
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: programKind
 *         schema: { $ref: '#/components/schemas/ProgramKind' }
 *     responses:
 *       200:
 *         description: The headings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScriptTemplateListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
customScriptRouter.get("/templates", CustomScriptController.getTemplates);

/**
 * @openapi
 * /v1/scripts/templates/{scriptUuid}:
 *   get:
 *     tags: [Scripts]
 *     summary: One set under a heading, by pattern
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       scriptUuid + questionPatternId is the whole lookup key - no companyId is
 *       read or checked here, so this only proves the caller can name a real
 *       heading and pattern, not that they own it.
 *
 *       Resolves to the one active set under that heading whose question pattern
 *       matches questionPatternId. 404 if the heading does not exist or holds no
 *       active set of that pattern; 409 if it somehow holds more than one, since
 *       nothing here can pick a winner between them.
 *     parameters:
 *       - in: path
 *         name: scriptUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: questionPatternId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScriptSetDetailResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
customScriptRouter.get("/templates/:scriptUuid", CustomScriptController.getTemplate);


/**
 * @openapi
 * /v1/scripts/update:
 *   post:
 *     tags: [Scripts]
 *     summary: Correct a question set
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Corrects a set that is already gathered by a heading - scriptUuid is
 *       required. A free-standing set (one no heading gathers yet) is
 *       `POST /scripts`'s to rewrite instead, by sending its scriptId there.
 *
 *       scriptId must be one of the sets under that heading. A new set and a new
 *       heading are created with the correction,
 *       both old rows are retired (not deleted, so a past call's transcript
 *       still matches the questions it was actually asked), and the new
 *       heading gets a new scriptUuid - returned in the response as
 *       `scriptUuid`, alongside the retired `previousScriptUuid`. Any job role
 *       still pointing at the old heading is moved onto the new one in the same
 *       transaction; `reassignedRoles` lists who moved.
 *
 *       Refused with 409 when: an interview is in progress on the heading; more
 *       than one job role is assigned to it (create a new question set
 *       instead - the response names them); or another heading also gathers
 *       this same set id (this flow only replaces a set gathered by exactly
 *       one heading).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCustomScriptRequest'
 *     responses:
 *       200:
 *         description: Replaced
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateCustomScriptResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
// Declared before /:scriptId, or Express reads "update" as a script id.
customScriptRouter.post("/update", CustomScriptController.postUpdateScript);

/**
 * @openapi
 * /v1/scripts/assign:
 *   post:
 *     tags: [Scripts]
 *     summary: Give one or more job roles a heading
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Points every listed job role at the same heading, by uuid. Bulk-safe,
 *       one transaction. The heading must hold at least one set.
 *
 *       assign: 0 checks for an existing assignment and refuses with 409
 *       instead of writing; assign: 1 (default) replaces it.
 *
 *       remove: 1 unassigns the listed roles instead, dropping them back to
 *       the default script. 404 if none has a live assignment.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignScriptRequest'
 *     responses:
 *       200:
 *         description: Assigned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AssignScriptResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
customScriptRouter.post("/assign", CustomScriptController.postAssign);

/**
 * @openapi
 * /v1/scripts/assignments:
 *   get:
 *     tags: [Scripts]
 *     summary: Who runs what
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Every live assignment for the company. Narrow by jobShortCode for one
 *       role, or by scriptUuid to answer "who would I break if I retired this".
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: jobShortCode
 *         schema: { type: string, maxLength: 50 }
 *       - in: query
 *         name: scriptUuid
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The assignments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AssignmentListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Declared before /:scriptId, or Express reads "assignments" as a script id.
customScriptRouter.get("/assignments", CustomScriptController.getAssignments);

/**
 * @openapi
 * /v1/scripts/patterns:
 *   get:
 *     tags: [Scripts]
 *     summary: The active question patterns
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       The fixed catalogue questionPattern is picked from when creating a
 *       question set. Reference data - the same for every company, and not
 *       company-scoped.
 *     responses:
 *       200:
 *         description: The patterns
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuestionPatternListResponse'
 */
// Declared before /:scriptId, or Express reads "patterns" as a script id.
customScriptRouter.get("/patterns", CustomScriptController.getPatterns);

/**
 * @openapi
 * /v1/scripts/default:
 *   get:
 *     tags: [Scripts]
 *     summary: The seeded default script
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       What scriptBuilder falls back to when a job role carries no custom
 *       heading - the sets seeded by seed:dev, one per pattern, in speaking
 *       order. Company-scoped, unlike /patterns.
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: programKind
 *         schema: { $ref: '#/components/schemas/ProgramKind' }
 *       - in: query
 *         name: participantRole
 *         schema: { type: string, enum: [ORGANISER, AGENT] }
 *       - in: query
 *         name: scriptType
 *         schema: { type: string, enum: [DEFAULT, OPTIONAL] }
 *     responses:
 *       200:
 *         description: The default sets
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DefaultScriptListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
// Declared before /:scriptId, or Express reads "default" as a script id.
customScriptRouter.get("/default", CustomScriptController.getDefaultScript);

customScriptRouter.get("/", CustomScriptController.getScripts);

/**
 * @openapi
 * /v1/scripts/{scriptId}:
 *   get:
 *     tags: [Scripts]
 *     summary: One set, with its questions
 *     security:
 *       - bearerAuth: []
 *     description: One set on its own. To read a whole script, read its heading instead.
 *     parameters:
 *       - in: path
 *         name: scriptId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScriptSetDetailResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Last, so a literal path segment is never swallowed by :scriptId.
customScriptRouter.get("/:scriptId", CustomScriptController.getScript);

export default customScriptRouter;

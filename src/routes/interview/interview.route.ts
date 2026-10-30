import { Router } from "express";
import { anamToolSecret } from "../../middlewares/anamToolSecret.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { InterviewController } from "../../controllers/interview/interview.controller";
import { InterviewCallController } from "../../controllers/interview/interviewCall.controller";
import { InterviewToolsController } from "../../controllers/interview/interviewTools.controller";

export const interviewRouter = Router();

/* -- called by Anam ------------------------------------------------------ */

const toolRouter = Router();
toolRouter.use(anamToolSecret);

/**
 * @openapi
 * /v1/interview/tools/ask-question:
 *   post:
 *     tags: [Interview Tools]
 *     summary: Mark a question as put to the candidate, and get its wording
 *     description: >
 *       Called immediately before the persona asks. It opens the answer-sheet
 *       entry with `outcome: asked` and stamps `askedTs`, which is what times
 *       the reply - `record-answer` fills in `answerSeconds` from it. An entry
 *       that is still `asked` does not count as answered, so it keeps blocking
 *       submit.
 *     security:
 *       - toolSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AskQuestionRequest'
 *     responses:
 *       200:
 *         description: The question as written, for the persona to ask
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToolResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
toolRouter.post("/ask-question", InterviewToolsController.postAskQuestion);

/**
 * @openapi
 * /v1/interview/tools/verify-contact:
 *   post:
 *     tags: [Interview Tools]
 *     summary: Check a detail the candidate stated against the one on file
 *     description: >
 *       Every tool answers 200 with a line to speak, even on failure - a 500
 *       mid-call leaves the persona silent. companyId is read from X-Company-Id,
 *       fixed when the tool was provisioned, so the model never gets to name it.
 *     security:
 *       - toolSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyContactRequest'
 *     responses:
 *       200:
 *         description: A line the persona can speak
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToolResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       503:
 *         description: ANAM_TOOL_SHARED_SECRET is unset, so the guard fails closed
 */
toolRouter.post("/verify-contact", InterviewToolsController.postVerifyContact);

/**
 * @openapi
 * /v1/interview/tools/record-answer:
 *   post:
 *     tags: [Interview Tools]
 *     summary: Store an answer and say what is left
 *     security:
 *       - toolSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecordAnswerRequest'
 *     responses:
 *       200:
 *         description: A line the persona can speak
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToolResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
toolRouter.post("/record-answer", InterviewToolsController.postRecordAnswer);

/**
 * @openapi
 * /v1/interview/tools/record-checklist:
 *   post:
 *     tags: [Interview Tools]
 *     summary: Store a yes/no checklist item and say what is left
 *     description: >
 *       record_answer's sibling for CHECKLIST-pattern questions - a fixed
 *       yes/no vocabulary instead of free-form scoring. Internally it is
 *       record_answer with outcome always `answered` and the yes/no kept in
 *       `data.outcome`, so a checklist item still counts toward submit the
 *       same way any other question does.
 *     security:
 *       - toolSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecordChecklistRequest'
 *     responses:
 *       200:
 *         description: A line the persona can speak
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToolResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
toolRouter.post("/record-checklist", InterviewToolsController.postRecordChecklist);

/**
 * @openapi
 * /v1/interview/tools/record-candidate-question:
 *   post:
 *     tags: [Interview Tools]
 *     summary: Record a question the candidate asked
 *     description: >
 *       Called once after every knowledge search, whether or not it answered them.
 *       Writes a `type: "FAQ"` entry on the answer sheet with `captured.found`, and
 *       when `found` is false also raises a follow-up on
 *       `tl_interview_call.escalations`. Deduplicated on the question text, and
 *       shared with `flag_for_staff` so the same question is chased once. These
 *       entries never carry a score and are excluded from question coverage.
 *     security:
 *       - toolSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecordCandidateQuestionRequest'
 *     responses:
 *       200:
 *         description: What to say, and whether it was escalated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToolResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
toolRouter.post("/record-candidate-question", InterviewToolsController.postRecordCandidateQuestion);

/**
 * @openapi
 * /v1/interview/tools/flag-for-staff:
 *   post:
 *     tags: [Interview Tools]
 *     summary: Record something for a human to follow up
 *     security:
 *       - toolSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FlagForStaffRequest'
 *     responses:
 *       200:
 *         description: A line the persona can speak
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToolResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
toolRouter.post("/flag-for-staff", InterviewToolsController.postFlagForStaff);

/**
 * @openapi
 * /v1/interview/tools/submit:
 *   post:
 *     tags: [Interview Tools]
 *     summary: Close the interview
 *     description: >
 *       Refused while a required question is still uncovered. Also carries the persona's
 *       rating of five bands - language proficiency, scenario-based response, cultural
 *       competence, professionalism, communication skills - each one to five and judged
 *       across the whole call, and a hiring recommendation. They are stored with their
 *       verdicts, the recommendation and the summary on
 *       tl_interview_call_answer.answers, under the submit_interview entry's captured
 *       .evaluation, and nowhere else: average_score keeps meaning the mean of the
 *       per-question scores. A missing or out-of-range rating is stored null rather than
 *       refusing the submit, so a finished candidate is never held in the room.
 *     security:
 *       - toolSecret: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitInterviewRequest'
 *     responses:
 *       200:
 *         description: A line the persona can speak
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToolResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
toolRouter.post("/submit", InterviewToolsController.postSubmitInterview);

// end_call has no route: it is Anam's own SYSTEM tool now, attached by id, and
// it tears the session down inside Anam rather than calling back here. A webhook
// could only ever write a row and leave the persona sitting in the room.

interviewRouter.use("/tools", toolRouter);

/* -- called by staff tooling --------------------------------------------- */

/**
 * @openapi
 * /v1/interview/personas:
 *   get:
 *     tags: [Interview]
 *     summary: Personas available for a company
 *     parameters:
 *       - in: query
 *         name: companyId
 *         schema: { type: integer }
 *         description: Omit to list every tenant's.
 *     responses:
 *       200:
 *         description: The personas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetPersonasResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
interviewRouter.get("/personas", InterviewController.getPersonas);

/**
 * @openapi
 * /v1/interview/config:
 *   get:
 *     tags: [Interview]
 *     summary: Readiness - credentials, provisioned tools, knowledge base
 *     description: >
 *       The check to run before dialling. `systemPrompt` is withheld in
 *       production. A 200 from POST /v1/teams/meetings proves Anam accepted the
 *       invite, not that any of this is configured.
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: personaKey
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: What is ready and what is not
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetInterviewConfigResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
interviewRouter.get("/config", InterviewController.getConfig);

/**
 * @openapi
 * /v1/interview/program:
 *   get:
 *     tags: [Interview]
 *     summary: The call outline, grouped by question set
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: jobShortCode
 *         schema: { type: string, maxLength: 50 }
 *         description: Selects that job role's own script. Omit for the company default.
 *       - in: query
 *         name: jobId
 *         schema: { type: integer }
 *         description: Accepted and selects nothing. Use jobShortCode.
 *       - in: query
 *         name: meetingSessionId
 *         schema: { type: integer }
 *         description: >
 *           Resolves through that meeting's pinned VaScheduled row instead of
 *           the job role's live assignment - the same script a live call would
 *           get. Adds scriptTemplateId and meetingStatus to the response.
 *     responses:
 *       200:
 *         description: The outline
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetProgramResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
interviewRouter.get("/program", InterviewController.getProgram);

/**
 * @openapi
 * /v1/interview/program/script:
 *   get:
 *     tags: [Interview]
 *     summary: The full rendered script text, exactly as the persona would read it
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: jobShortCode
 *         schema: { type: string, maxLength: 50 }
 *         description: Selects that job role's own script. Omit for the company default.
 *       - in: query
 *         name: jobId
 *         schema: { type: integer }
 *         description: Accepted and selects nothing. Use jobShortCode.
 *       - in: query
 *         name: meetingSessionId
 *         schema: { type: integer }
 *         description: >
 *           Resolves through that meeting's pinned VaScheduled row instead of
 *           the job role's live assignment - the same script a live call would
 *           get. Adds scriptTemplateId and meetingStatus to the response.
 *     responses:
 *       200:
 *         description: >
 *           The assembled script text - question, context, expected answer and
 *           outcome phrasing included. No candidate is known outside a live
 *           call, so [agent_name], [company_name] and [candidate_name] are left
 *           standing rather than filled.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetProgramScriptResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
interviewRouter.get("/program/script", InterviewController.getProgramScript);

/**
 * @openapi
 * /v1/interview/sessions/{sessionReference}/answers:
 *   get:
 *     tags: [Interview]
 *     summary: The answer sheet for a session, keyed on the question asked
 *     description: >
 *       Resolves the session's latest interview call and returns
 *       `tl_interview_call_answer.answers` keyed on `question.body`, strictly in
 *       the order things happened, rejoins included. Consecutive entries for the
 *       same question share one key; a question that comes up again later gets
 *       its own key with " (2)", " (3)" and so on, so it sits where it happened.
 *       `answer.body` is the persona's summary; `answer.rawResponse`
 *       is the candidate's words verbatim, and is null on an entry recorded
 *       before the verbatim was captured or still waiting on an answer.
 *       Questions the persona put but never got an answer to come back with
 *       `outcome: "asked"` and an empty body rather than being left out.
 *       `submit_interview` and `end_call` appear as `type: "LIFECYCLE"` entries.
 *       `expectedAnswer` is never returned.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         description: The session uuid, or its numeric meeting_session_id.
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The sheet, with the call it was resolved from
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetCallAnswersResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
interviewRouter.get("/sessions/:sessionReference/answers", authenticate, InterviewCallController.getSessionAnswers);

/**
 * @openapi
 * /v1/interview/sessions/{sessionReference}/escalations:
 *   get:
 *     tags: [Interview]
 *     summary: Everything the persona could not answer in a session
 *     description: >
 *       Reads `tl_interview_call.escalations` for every call attempt of the
 *       session and returns them as one list, oldest first. Each entry says
 *       which attempt it came from, so a rejoin does not hide what was raised
 *       before it. A session with no call yet, or no escalations, returns an
 *       empty list rather than a 404. `suggestedOwner` is who the persona told
 *       the candidate would follow up.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         description: The session uuid, or its numeric meeting_session_id.
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The escalations, with a total
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetSessionEscalationsResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
interviewRouter.get("/sessions/:sessionReference/escalations", authenticate, InterviewCallController.getSessionEscalations);

/**
 * @openapi
 * /v1/interview/sessions/{sessionReference}/evaluation:
 *   get:
 *     tags: [Interview]
 *     summary: The persona's rating of a session, and nothing else from the sheet
 *     description: >
 *       The five-band evaluation, recommendation and summary, read from the `submit_interview`
 *       entry's `captured.evaluation` on `tl_interview_call_answer.answers` for the
 *       session's latest call. The session is the whole address - no companyId -
 *       and an unknown one is a 404. `averageScore` is the mean of the per-question
 *       scores, not of these bands. Each band carries `basis`, the persona's own
 *       reasoning for its score, null on calls submitted before it was captured.
 *       A call that never submitted comes back with a
 *       null recommendation, summary and bands rather than a 404. No answers, transcript or
 *       contact details are returned.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         description: The session uuid, or its numeric meeting_session_id.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The evaluation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetSessionEvaluationResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
interviewRouter.get("/sessions/:sessionReference/evaluation", authenticate, InterviewCallController.getSessionEvaluation);


export default interviewRouter;

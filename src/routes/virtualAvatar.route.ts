import { Router } from "express";
import { MeetingHistoryController } from "../controllers/virtualAvatar/meetingHistory.controller";
import { MeetingTranscriptController } from "../controllers/virtualAvatar/meetingTranscript.controller";
import { VirtualAvatarLobbyController } from "../controllers/virtualAvatar/virtualAvatarLobby.controller";
import { VirtualAvatarRecordingController } from "../controllers/virtualAvatar/virtualAvatarRecording.controller";
import { VaStatusController } from "../controllers/virtualAvatar/vaStatus.controller";
import { VirtualAvatarSessionController } from "../controllers/virtualAvatar/virtualAvatarSession.controller";
import { acsWebhookSecret } from "../middlewares/acsWebhook.middleware";
import { desktopOnly } from "../middlewares/desktopOnly.middleware";

/**
 * Three groups of callers with different trust.
 *
 * /sessions is staff tooling. /join is the page a recipient opens from their
 * email, holding nothing but their own link. /webhooks is Azure.
 *
 * Auth on the first group is not wired yet by decision - when it is, it is one
 * use() and nothing else moves. The join group must stay public: an email
 * recipient carries no token but the one in their link.
 */
export const virtualAvatarRouter = Router();

/**
 * @openapi
 * /v1/va/statuses:
 *   get:
 *     tags: [VA]
 *     summary: Every status a scheduled interview can hold
 *     description: >
 *       Read from tl_va_meeting_status, not hardcoded. meetingStatus is the status the
 *       meeting itself takes when a booking reaches this one, or null if it
 *       leaves the meeting alone. Not company-scoped.
 *     responses:
 *       200:
 *         description: Statuses in display order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VaStatusListResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
virtualAvatarRouter.get("/statuses", VaStatusController.getStatuses);

/**
 * @openapi
 * /v1/va/ai-recommendation-statuses:
 *   get:
 *     tags: [VA]
 *     summary: Every verdict the AI can give an interview
 *     description: >
 *       Read from tl_ai_recommendation_status, not hardcoded. These are the
 *       values tl_application_details.ai_recommendation may hold. Not
 *       company-scoped.
 *     responses:
 *       200:
 *         description: Statuses in display order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AiRecommendationStatusListResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
virtualAvatarRouter.get("/ai-recommendation-statuses", VaStatusController.getAiRecommendationStatuses);

/* -- sessions ------------------------------------------------------------ */

/**
 * @openapi
 * /v1/va/sessions:
 *   get:
 *     tags: [VA]
 *     summary: List sessions for a company
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [SCHEDULED, RESCHEDULED, ACTIVE, ENDED, EXPIRED, REVOKED, CANCELLED] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 25 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200:
 *         description: Sessions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarSessionListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 */
virtualAvatarRouter.get("/sessions", VirtualAvatarSessionController.getSessions);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}:
 *   get:
 *     tags: [VA]
 *     summary: The whole meeting in one read - participants, links, email state
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarSessionResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/sessions/:sessionReference", VirtualAvatarSessionController.getSession);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/attendees:
 *   get:
 *     tags: [VA]
 *     summary: Who actually attended the meeting
 *     description: >
 *       Only the participants who made it into the call, in join order. Someone
 *       who never opened their link, is still waiting in the lobby, was denied or
 *       simply never showed up is not returned - attendance is read off joined_ts,
 *       which is written only once ACS credentials were handed out, so a failed
 *       join is not counted either. Accepts the meeting uuid or its numeric
 *       meeting_session_id. Ending or cancelling the meeting closes off everyone
 *       still in it, so after the call every row carries a leftAt and a
 *       durationSeconds; both are null only while someone is still in a live call.
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         description: The meeting uuid, or its numeric meeting_session_id.
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The attendees in join order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarAttendeeListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/sessions/:sessionReference/attendees", VirtualAvatarSessionController.getAttendees);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/history:
 *   get:
 *     tags: [VA]
 *     summary: Everything that happened in one meeting, latest first
 *     description: >
 *       Reads tl_meeting_history_event: mail, join and recording steps, successes and
 *       failures together. Newest first, paged with limit and offset. step is the
 *       row's place in the order it happened (1 is the oldest), so it stays the same
 *       whichever page you read. A plain OK row carries no details; FAILED, SKIPPED
 *       and RETRIED rows keep theirs. summary always covers the whole meeting, not just
 *       the page or the outcome filter. open on a failure is true when no later OK or
 *       RETRIED row exists for the same track and provider; it is null on every other
 *       row. finalStatus is the schedule status the meeting last reached (COMPLETED,
 *       MISSED, INTERRUPTED, CANCELLED and so on) and is null for a meeting with no
 *       booking. errorMessage is the raw provider error with emails and bearer tokens
 *       masked. Accepts the meeting uuid or its numeric meeting_session_id. A meeting
 *       with no history returns an empty list, not a 404.
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         description: The meeting uuid, or its numeric meeting_session_id.
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: outcome
 *         description: Only rows with this outcome. Use FAILED to see just the failures.
 *         schema: { type: string, enum: [OK, SKIPPED, RETRIED, FAILED] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200:
 *         description: One page of the meeting's history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarHistoryResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/sessions/:sessionReference/history", MeetingHistoryController.getHistory);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/transcript:
 *   get:
 *     tags: [VA]
 *     summary: The stored transcript of one meeting, oldest line first
 *     description: >
 *       Reads tl_meeting_transcript: one row per finalised spoken line, in the order
 *       it was said. speakerRole is the role of the participant the line was matched
 *       to (AGENT is the AI interviewer) and is null when the speaker could not be
 *       matched. offsetSeconds counts from the first join (startedAt), falling back
 *       to the first line, so it lines up with the recording only approximately.
 *       translations holds whatever translations were stored while the call ran.
 *       Accepts the meeting uuid or its numeric meeting_session_id. A meeting with
 *       no transcript returns an empty list, not a 404.
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         description: The meeting uuid, or its numeric meeting_session_id.
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Every stored line of the meeting
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarMeetingTranscriptResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/sessions/:sessionReference/transcript", MeetingTranscriptController.getTranscript);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/end:
 *   post:
 *     tags: [VA]
 *     summary: Stop the recording and end the room
 *     description: >
 *       The room's window is shortened rather than deleted - a deleted ACS room
 *       drops everyone instantly, so the call is given a minute to wind down.
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EndVirtualAvatarSessionRequest'
 *     responses:
 *       200:
 *         description: Ended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarSessionResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.post("/sessions/:sessionReference/end", VirtualAvatarSessionController.postEnd);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/extend:
 *   post:
 *     tags: [VA]
 *     summary: Push the room's validUntil out, so a live call is not cut off
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtendVirtualAvatarSessionRequest'
 *     responses:
 *       200:
 *         description: Extended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarSessionResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.post("/sessions/:sessionReference/extend", VirtualAvatarSessionController.postExtend);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/revoke-links:
 *   post:
 *     tags: [VA]
 *     summary: Kill every invite link. The call already running is untouched
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RevokeVirtualAvatarLinksRequest'
 *     responses:
 *       200:
 *         description: Revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarSessionResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.post("/sessions/:sessionReference/revoke-links", VirtualAvatarSessionController.postRevokeLinks);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/reset-candidate-session:
 *   post:
 *     tags: [VA]
 *     summary: Release the candidate's one-browser lock so the link can be opened from another browser
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RevokeVirtualAvatarLinksRequest'
 *     responses:
 *       200:
 *         description: Reset
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarSessionResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post(
    "/sessions/:sessionReference/reset-candidate-session",
    VirtualAvatarSessionController.postResetCandidateSession,
);

/* -- the lobby ----------------------------------------------------------- */

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/lobby:
 *   get:
 *     tags: [VA]
 *     summary: Agents waiting to be let in. Organiser only
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: organiserRef
 *         required: true
 *         description: The organiser's own invite token - this, not companyId, is what proves authority.
 *         schema: { type: string, minLength: 32, maxLength: 64 }
 *     responses:
 *       200:
 *         description: The waiting list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarLobbyResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.get("/sessions/:sessionReference/lobby", VirtualAvatarLobbyController.getLobby);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/lobby/{participantId}/decision:
 *   post:
 *     tags: [VA]
 *     summary: Admit or deny a waiting agent
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VirtualAvatarDecisionRequest'
 *     responses:
 *       200:
 *         description: Decision recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarDecisionResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/sessions/:sessionReference/lobby/:participantId/decision", VirtualAvatarLobbyController.postDecision);

/* -- recordings ---------------------------------------------------------- */

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/recordings:
 *   get:
 *     tags: [VA]
 *     summary: Recordings for a session and where they were stored
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Recordings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeetingRecordingListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/sessions/:sessionReference/recordings", VirtualAvatarRecordingController.getRecordings);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/recordings/signed-url:
 *   get:
 *     tags: [VA]
 *     summary: Signed playback links for a meeting's recordings
 *     description: >
 *       Every recording on the meeting, each with a freshly minted signed URL
 *       that plays without any further credentials. Accepts either the meeting
 *       uuid or its numeric meeting_session_id. A recording that fell back to
 *       local disk carries signedUrl null - play it through
 *       /v1/va/recordings/{recordingId}/file instead. Nothing is stored: the
 *       link is minted per request, so a stale one is never handed out.
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         description: The meeting uuid, or its numeric meeting_session_id.
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: expiresIn
 *         description: >
 *           Seconds the link stays valid, 30 to 604800. Defaults to
 *           VA_RECORDING_URL_TTL_SECONDS. Must outlast watching the video, since
 *           a player seeks against the resolved URL.
 *         schema: { type: integer, minimum: 30, maximum: 604800 }
 *     responses:
 *       200:
 *         description: Signed links
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeetingRecordingLinkListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get(
    "/sessions/:sessionReference/recordings/signed-url",
    VirtualAvatarRecordingController.getSessionSignedUrls,
);

/**
 * @openapi
 * /v1/va/sessions/{sessionReference}/recordings/download:
 *   get:
 *     tags: [VA]
 *     summary: Download a meeting's recording as one mp4 file
 *     description: >
 *       Picks the meeting's latest STORED recording, mints a signed file-service
 *       URL for each of its slices and pipes them in order with
 *       Content-Disposition attachment, so a recording split past the bucket's
 *       500MB cap still downloads as one playable file. Range is honoured, so an
 *       interrupted download can resume. Accepts the meeting uuid or its numeric
 *       meeting_session_id. A meeting with nothing stored yet is a 409.
 *     parameters:
 *       - in: path
 *         name: sessionReference
 *         required: true
 *         description: The meeting uuid, or its numeric meeting_session_id.
 *         schema: { type: string }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: header
 *         name: Range
 *         required: false
 *         description: "Byte range, e.g. `bytes=1048576-`. Answered with 206 and a Content-Range."
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The whole recording
 *         headers:
 *           Content-Disposition: { schema: { type: string }, description: "`attachment; filename=\"<file>.mp4\"`" }
 *           Content-Length: { schema: { type: integer }, description: Total size across every slice }
 *         content:
 *           video/mp4:
 *             schema: { type: string, format: binary }
 *       206:
 *         description: The requested byte range
 *         headers:
 *           Content-Range: { schema: { type: string }, description: "`bytes <start>-<end>/<total>`" }
 *         content:
 *           video/mp4:
 *             schema: { type: string, format: binary }
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       416:
 *         description: The requested range lies outside the recording
 */
virtualAvatarRouter.get(
    "/sessions/:sessionReference/recordings/download",
    VirtualAvatarRecordingController.downloadSessionRecording,
);

/**
 * @openapi
 * /v1/va/recordings/{recordingId}/signed-url:
 *   get:
 *     tags: [VA]
 *     summary: A signed playback link for one recording
 *     description: >
 *       The same link the /file endpoint redirects to, handed back as JSON so it
 *       can be embedded or shared. Only a STORED recording is signable -
 *       anything earlier is a 409.
 *     parameters:
 *       - in: path
 *         name: recordingId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: expiresIn
 *         description: Seconds the link stays valid, 30 to 604800. Defaults to VA_RECORDING_URL_TTL_SECONDS.
 *         schema: { type: integer, minimum: 30, maximum: 604800 }
 *     responses:
 *       200:
 *         description: A signed link
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeetingRecordingLinkResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.get(
    "/recordings/:recordingId/signed-url",
    VirtualAvatarRecordingController.getRecordingSignedUrl,
);

/**
 * @openapi
 * /v1/va/recordings/{recordingId}/file:
 *   get:
 *     tags: [VA]
 *     summary: Redirect to a stored recording
 *     description: >
 *       Always a 302 to a short-lived presigned file-service URL, which serves
 *       the bytes and handles Range itself - nothing is served off this service.
 *       Only a STORED recording is servable; anything earlier is a 409. A row
 *       stored before recordings went straight to the object store has
 *       `storageKind: "local"` and cannot be presigned, so it 500s - its file is
 *       still on the box but no longer reachable through the API.
 *     parameters:
 *       - in: path
 *         name: recordingId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       302:
 *         description: >
 *           Redirects to a short-lived presigned file-service URL, which serves
 *           the bytes and handles Range itself.
 *         headers:
 *           Location: { schema: { type: string }, description: Presigned https URL }
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.get("/recordings/:recordingId/file", VirtualAvatarRecordingController.getRecordingFile);

/**
 * @openapi
 * /v1/va/recordings/{recordingId}/stream:
 *   get:
 *     tags: [VA]
 *     summary: Stream a stored recording as one seekable video
 *     description: >
 *       Serves the whole recording however it was stored. The bucket caps one
 *       object at 500MB, so a recording past roughly an hour and a half is held as
 *       several raw byte slices - only their concatenation is playable, so this
 *       maps an incoming Range onto the slices it covers and pipes them in order.
 *       Seekable, and usable directly as the src of a video element. Unlike /file
 *       this returns the bytes rather than a redirect, so a split recording plays
 *       as one video; a recording that was never split has one slice and is simply
 *       passed through. Only a STORED recording is servable; anything earlier is a 409.
 *     parameters:
 *       - in: path
 *         name: recordingId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema: { type: integer }
 *       - in: header
 *         name: Range
 *         required: false
 *         description: "Byte range, e.g. `bytes=0-1048575`. Answered with 206 and a Content-Range."
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The whole recording
 *         headers:
 *           Accept-Ranges: { schema: { type: string }, description: Always `bytes` }
 *           Content-Length: { schema: { type: integer }, description: Total size across every slice }
 *         content:
 *           video/mp4:
 *             schema: { type: string, format: binary }
 *       206:
 *         description: The requested byte range
 *         headers:
 *           Content-Range: { schema: { type: string }, description: "`bytes <start>-<end>/<total>`" }
 *         content:
 *           video/mp4:
 *             schema: { type: string, format: binary }
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       416:
 *         description: The requested range lies outside the recording
 */
virtualAvatarRouter.get("/recordings/:recordingId/stream", VirtualAvatarRecordingController.streamRecording);

/* -- called by the join page --------------------------------------------- */

/**
 * @openapi
 * /v1/va/join/{inviteToken}:
 *   get:
 *     tags: [VA]
 *     summary: What this link is for, and who holds it
 *     description: >
 *       Returns the holder's name and role and whether they will wait in a lobby,
 *       so the page can render before anyone clicks. No credentials, no seat taken.
 *     parameters:
 *       - in: path
 *         name: inviteToken
 *         required: true
 *         schema: { type: string, minLength: 32, maxLength: 64 }
 *     responses:
 *       200:
 *         description: Link state and the holder's role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarPreflightResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/join/:inviteToken", desktopOnly, VirtualAvatarSessionController.getPreflight);

/**
 * @openapi
 * /v1/va/join/{inviteToken}/participants:
 *   get:
 *     tags: [VA]
 *     summary: Everyone invited to this meeting, for the call's roster panel
 *     description: >
 *       Scoped by the caller's own link, not a company id - the join page holds
 *       nothing else.
 *     parameters:
 *       - in: path
 *         name: inviteToken
 *         required: true
 *         schema: { type: string, minLength: 32, maxLength: 64 }
 *     responses:
 *       200:
 *         description: The invited participants
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarParticipantListResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/join/:inviteToken/participants", VirtualAvatarSessionController.getParticipants);

/**
 * @openapi
 * /v1/va/join/{inviteToken}/public-link:
 *   get:
 *     tags: [VA]
 *     summary: The meeting's public link, for the "Add user to call" button
 *     description: >
 *       Returns tl_meeting_session.public_link so an organiser or guest can pass
 *       it on. The caller must hold a personal token whose role is ORGANIZER or
 *       GUEST. A CANDIDATE or AGENT token, or the public link itself, is a 409 -
 *       this is the real restriction, the call page only hides the button.
 *     parameters:
 *       - in: path
 *         name: inviteToken
 *         required: true
 *         schema: { type: string, minLength: 32, maxLength: 64 }
 *     responses:
 *       200:
 *         description: The public link
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarPublicLinkResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.get("/join/:inviteToken/public-link",VirtualAvatarSessionController.getPublicLink);

/**
 * @openapi
 * /v1/va/join/{inviteToken}/questions:
 *   get:
 *     tags: [VA]
 *     summary: The questions this session's agent will ask, grouped by question type
 *     description: >
 *       Resolved exactly the way the live call resolves them - through this
 *       meeting's pinned VaScheduled template, falling back to the candidate's job
 *       role assignment and then the company default - so the panel lists what the
 *       persona actually asks. [agent_name], [company_name] and [candidate_name]
 *       are filled from this session. Readable before the call opens and without
 *       being admitted: the holder's own link is the whole credential, and only an
 *       ORGANIZER or the AGENT may read it. A candidate or guest token is a 409.
 *       `expectedAnswer` and `evaluationGuidance` are never returned - they are the
 *       bar the candidate is judged against. Group on `questionPattern`;
 *       `patternOrder` is that type's display order.
 *     parameters:
 *       - in: path
 *         name: inviteToken
 *         required: true
 *         schema: { type: string, minLength: 32, maxLength: 64 }
 *     responses:
 *       200:
 *         description: The question sets in asking order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarSessionQuestionsResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.get("/join/:inviteToken/questions", VirtualAvatarSessionController.getSessionQuestions);

/**
 * @openapi
 * /v1/va/join/{inviteToken}/transcript:
 *   get:
 *     tags: [VA]
 *     summary: The meeting's live transcript so far, with translations for the holder's language
 *     description: >
 *       Lines come from ACS live transcription, one row per final phrase in
 *       tl_meeting_transcript. Lines missing a translation into the holder's
 *       chosen transcript language are translated before they are returned. New
 *       lines arrive over the socket as va:transcript.
 *     parameters:
 *       - in: path
 *         name: inviteToken
 *         required: true
 *         schema: { type: string, minLength: 32, maxLength: 64 }
 *     responses:
 *       200:
 *         description: The transcription state, languages and lines
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarTranscriptResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/join/:inviteToken/transcript", VirtualAvatarSessionController.getTranscript);

/**
 * @openapi
 * /v1/va/join/{inviteToken}/transcript/{lineId}/speech:
 *   get:
 *     tags: [VA]
 *     summary: One transcript line read aloud in the holder's transcript language
 *     description: >
 *       Azure text to speech of the line's translation into the holder's
 *       language, or of the original when there is none.
 *     parameters:
 *       - in: path
 *         name: inviteToken
 *         required: true
 *         schema: { type: string, minLength: 32, maxLength: 64 }
 *       - in: path
 *         name: lineId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The spoken line
 *         content:
 *           audio/mpeg:
 *             schema: { type: string, format: binary }
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.get("/join/:inviteToken/transcript/:lineId/speech", VirtualAvatarSessionController.getTranscriptSpeech);

/**
 * @openapi
 * /v1/va/join/guest:
 *   post:
 *     tags: [VA]
 *     summary: A public-link visitor gives their email and name before joining
 *     description: >
 *       Only the meeting's public link is accepted - a personal link is a 409.
 *       Stores a row in tl_meeting_participants and returns that holder's own
 *       guestRef, which the page then sends to POST /v1/va/join (and to
 *       claim, refresh and leave). POST /v1/va/join with the public link alone
 *       is refused. The same email registering again gets the same guestRef back;
 *       an email that already holds a candidate or agent invite is a 409.
 *       An address on the organiser domain is stored as ORGANIZER and joins on that
 *       footing; any other address is a GUEST and must belong to a registered Workable
 *       member or it is refused, where a 503 means that check could not be made.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VirtualAvatarGuestRequest'
 *     responses:
 *       200:
 *         description: The guest's own reference
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarGuestResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join/guest", desktopOnly, VirtualAvatarSessionController.postGuest);

/**
 * @openapi
 * /v1/va/join/claim:
 *   post:
 *     tags: [VA]
 *     summary: Collect credentials once an organiser has admitted you
 *     description: >
 *       The socket only signals the decision; the ACS token is always fetched
 *       here over HTTPS. Doubles as the poll when a socket cannot connect.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VirtualAvatarTokenRequest'
 *     responses:
 *       200:
 *         description: ACS credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarCredentialsResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join/claim", desktopOnly, VirtualAvatarSessionController.postClaim);

/**
 * @openapi
 * /v1/va/join/persona-token:
 *   post:
 *     tags: [VA]
 *     summary: Mint the Anam session token for an admitted AI agent
 *     description: >
 *       The bridge holds no API key, so the persona is resolved and the token
 *       minted here. AGENT participants only, and only once admitted.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VirtualAvatarTokenRequest'
 *     responses:
 *       200:
 *         description: A short-lived Anam session token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarPersonaTokenResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join/persona-token", VirtualAvatarSessionController.postPersonaToken);

/**
 * @openapi
 * /v1/va/join/raw-transcript:
 *   post:
 *     tags: [VA]
 *     summary: Store the raw Anam event log for a call
 *     description: >
 *       The bridge sends everything the Anam client emitted (streamed message
 *       chunks, interruptions, tool calls, user speech) so a misbehaving call can
 *       be reread later. Every run of the bridge sends its own `attemptId`: a post
 *       replaces that run's events and keeps every earlier run's, so a rejoin
 *       adds to the timeline instead of wiping it. Stored ordered by `at`, each
 *       event tagged with its attemptId. AGENT participants only. Saved on
 *       tl_interview_call_answer.raw_transcript.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ref, attemptId, events]
 *             properties:
 *               ref:
 *                 type: string
 *               attemptId:
 *                 type: string
 *                 maxLength: 40
 *               events:
 *                 type: array
 *                 maxItems: 8000
 *                 items:
 *                   type: object
 *                   required: [at, type]
 *                   properties:
 *                     at: { type: string }
 *                     type: { type: string }
 *                     data: {}
 *     responses:
 *       200:
 *         description: How many events were stored
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: No interview call exists for this session
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join/raw-transcript", VirtualAvatarSessionController.postRawTranscript);

/**
 * @openapi
 * /v1/va/join/persona-log:
 *   post:
 *     tags: [VA]
 *     summary: Append debugging lines from the persona bridge's Anam join
 *     description: >
 *       The bridge posts one line per step of joining the call and starting the
 *       Anam stream, and one per failure, so a join that went wrong can be read
 *       back later. Entries are added to the one row kept per meeting session, never replaced. Stored in
 *       tl_persona_join_log. AGENT participants only. `attemptId` is made by the
 *       browser for each run, so two runs overlapping in one meeting show up as
 *       two ids. `at` is the browser's clock; the row also gets the server's.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ref, events]
 *             properties:
 *               ref:
 *                 type: string
 *               events:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 50
 *                 items:
 *                   type: object
 *                   required: [attemptId, at, level, stage, message]
 *                   properties:
 *                     attemptId: { type: string, maxLength: 40 }
 *                     at: { type: string, format: date-time }
 *                     level: { type: string, enum: [INFO, WARN, ERROR] }
 *                     stage: { type: string, example: ANAM_STREAM_RESOLVED }
 *                     message: { type: string, maxLength: 500 }
 *                     detail: { type: object }
 *     responses:
 *       200:
 *         description: How many lines were stored
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: No session for this link
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join/persona-log", VirtualAvatarSessionController.postPersonaJoinLog);

/**
 * @openapi
 * /v1/va/join/transcript/language:
 *   post:
 *     tags: [VA]
 *     summary: The language this holder reads and hears the transcript in
 *     description: >
 *       Every later line is translated into it while the holder is in the call.
 *       null shows lines as spoken. A shared link has no language - 409.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ref, language]
 *             properties:
 *               ref: { type: string }
 *               language: { type: string, nullable: true, example: es }
 *     responses:
 *       200:
 *         description: The saved language
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join/transcript/language", VirtualAvatarSessionController.postTranscriptLanguage);

/**
 * @openapi
 * /v1/va/join/transcription:
 *   post:
 *     tags: [VA]
 *     summary: Pause, resume or switch the spoken language of live transcription
 *     description: >
 *       Admitted organisers only. ACTIVE starts or resumes ACS transcription,
 *       PAUSED stops it, and language changes the locale it listens for - one
 *       spoken language per call. Everyone in the call gets va:transcription_state.
 *       503 when the call bot is not connected.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ref]
 *             properties:
 *               ref: { type: string }
 *               status: { type: string, enum: [ACTIVE, PAUSED] }
 *               language: { type: string, example: es }
 *     responses:
 *       200:
 *         description: The transcription state now
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarTranscriptionResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       503:
 *         description: The call bot is not connected
 */
virtualAvatarRouter.post("/join/transcription", VirtualAvatarSessionController.postTranscription);

/**
 * @openapi
 * /v1/va/join/agent:
 *   post:
 *     tags: [VA]
 *     summary: Send the AI agent in, hosted by the organiser's tab
 *     description: >
 *       Called by the join page once an organiser is in the call, with the
 *       organiser's own token. Puts the agent in the lobby and returns its invite
 *       token to exactly one tab - it still waits to be admitted. No token when
 *       there is no agent, an organiser denied it, or another tab already has it.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VirtualAvatarTokenRequest'
 *     responses:
 *       200:
 *         description: The handoff, or why there is none
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarAgentHandoffResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join/agent", VirtualAvatarSessionController.postHostAgent);

/**
 * @openapi
 * /v1/va/join/refresh:
 *   post:
 *     tags: [VA]
 *     summary: Re-mint an ACS token for a participant already in the call
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VirtualAvatarTokenRequest'
 *     responses:
 *       200:
 *         description: ACS credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarCredentialsResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join/refresh", desktopOnly, VirtualAvatarSessionController.postRefresh);

/**
 * @openapi
 * /v1/va/join/leave:
 *   post:
 *     tags: [VA]
 *     summary: Mark the holder as having left, freeing their seat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VirtualAvatarTokenRequest'
 *     responses:
 *       200:
 *         description: Left
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
virtualAvatarRouter.post("/join/leave", VirtualAvatarSessionController.postLeave);

/**
 * @openapi
 * /v1/va/join:
 *   post:
 *     tags: [VA]
 *     summary: Open the link
 *     description: >
 *       Takes a personal token and nothing else. An organiser or guest is admitted
 *       immediately and receives ACS credentials; an agent is placed in the lobby
 *       and claims once an organiser decides. The public link alone is a 409 -
 *       register through POST /v1/va/join/guest first.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VirtualAvatarTokenRequest'
 *     responses:
 *       200:
 *         description: ADMITTED with credentials, or PENDING
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VirtualAvatarJoinResponse'
 *       403:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
virtualAvatarRouter.post("/join", desktopOnly, VirtualAvatarSessionController.postJoin);

/* -- called by azure ----------------------------------------------------- */

/**
 * @openapi
 * /v1/va/webhooks/call-events:
 *   post:
 *     tags: [VA]
 *     summary: Event Grid callback - subscription validation and recording files
 *     description: >
 *       Answers the validation handshake before the subscription exists, and
 *       acknowledges a file event immediately - the download happens after the
 *       response, because Event Grid retries anything slow enough to time out.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Validation handshake answered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventGridValidationResponse'
 *       202:
 *         description: Event accepted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
virtualAvatarRouter.post("/webhooks/call-events", acsWebhookSecret, VirtualAvatarRecordingController.postCallEvents);

export default virtualAvatarRouter;

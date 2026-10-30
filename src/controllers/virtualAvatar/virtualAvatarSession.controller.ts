import { Request, Response } from "express";
import { handle, validate } from "../../helpers/controller.helper";
import { ensureDeviceKey, readDeviceKey } from "../../helpers/deviceKey.helper";
import * as meeting from "../../services/meeting/meetingSession.service";
import * as virtualAvatarPersona from "../../services/virtualAvatar/virtualAvatarPersona.service";
import * as meetingJoin from "../../services/meeting/meetingJoin.service";
import * as recording from "../../services/meeting/meetingRecording.service";
import * as transcript from "../../services/meeting/meetingTranscript.service";
import {
    endSessionSchema,
    extendSessionSchema,
    guestRegistrationSchema,
    inviteTokenParamsSchema,
    joinSchema,
    listSessionsQuerySchema,
    personaJoinLogSchema,
    rawTranscriptSchema,
    resetCandidateSessionSchema,
    revokeLinksSchema,
    sessionParamsSchema,
    sessionQuerySchema,
    transcriptLanguageSchema,
    transcriptLineParamsSchema,
    transcriptionControlSchema,
} from "../../validators/virtualAvatar.validator";

/**
 * The meeting and the join flow.
 *
 * Everything under join is called by the page a recipient opens. Their link is
 * the whole credential, so those endpoints take a token and nothing else.
 *
 * There is no create endpoint: a meeting exists because an interview invite
 * mail arrived and was verified.
 */
export class VirtualAvatarSessionController {
    public static readonly getSessions = handle(async (req: Request, res: Response) => {
        const request = validate(listSessionsQuerySchema, req.query);
        const result = await meeting.listMeetings(request);

        return res.successResponse(result);
    });

    public static readonly getSession = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(sessionQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const session = await meeting.getMeeting(companyId, sessionReference);

        return res.successResponse(session);
    });

    public static readonly getAttendees = handle(async (req: Request, res: Response) => {
        const { companyId } = validate(sessionQuerySchema, req.query);
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const attendance = await meeting.listAttendees(companyId, sessionReference);

        return res.successResponse(attendance);
    });

    public static readonly postEnd = handle(async (req: Request, res: Response) => {
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const { companyId, reason } = validate(endSessionSchema, req.body);
        const session = await meeting.endMeeting(companyId, sessionReference, reason);

        return res.successResponse(session, "Meeting ended");
    });

    public static readonly postExtend = handle(async (req: Request, res: Response) => {
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const { companyId, minutes } = validate(extendSessionSchema, req.body);
        const session = await meeting.extendMeeting(companyId, sessionReference, minutes);

        return res.successResponse(session, "Meeting extended");
    });

    public static readonly postRevokeLinks = handle(async (req: Request, res: Response) => {
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const { companyId } = validate(revokeLinksSchema, req.body);
        const session = await meeting.revokeLinks(companyId, sessionReference);

        return res.successResponse(session, "Session links revoked");
    });

    public static readonly postResetCandidateSession = handle(async (req: Request, res: Response) => {
        const { sessionReference } = validate(sessionParamsSchema, req.params);
        const { companyId } = validate(resetCandidateSessionSchema, req.body);
        const session = await meeting.resetCandidateSession(companyId, sessionReference);

        return res.successResponse(session, "Candidate session reset");
    });

    /* -- the join page ---------------------------------------------------- */

    public static readonly getPreflight = handle(async (req: Request, res: Response) => {
        const { inviteToken } = validate(inviteTokenParamsSchema, req.params);
        const preflight = await meetingJoin.preflight(inviteToken, readDeviceKey(req));

        return res.successResponse(preflight);
    });

    public static readonly getParticipants = handle(async (req: Request, res: Response) => {
        const { inviteToken } = validate(inviteTokenParamsSchema, req.params);
        const participants = await meetingJoin.listParticipants(inviteToken);

        return res.successResponse({ participants });
    });

    public static readonly getSessionQuestions = handle(async (req: Request, res: Response) => {
        const { inviteToken } = validate(inviteTokenParamsSchema, req.params);
        const questions = await virtualAvatarPersona.listSessionQuestions(inviteToken);

        return res.successResponse(questions);
    });

    // public static readonly postGuest = handle(async (req: Request, res: Response) => {
    public static readonly getPublicLink = handle(async (req: Request, res: Response) => {
        const { inviteToken } = validate(inviteTokenParamsSchema, req.params);
        const publicLink = await meetingJoin.publicLinkFor(inviteToken);

        return res.successResponse({ publicLink });
    });

    public static readonly postGuest =handle(async (req: Request, res: Response) => {
        const registration = validate(guestRegistrationSchema, req.body);
        const guest = await meetingJoin.registerGuest(registration);

        return res.successResponse(guest, "Guest registered");
    });

    public static readonly postJoin = handle(async (req: Request, res: Response) => {
        const { ref } = validate(joinSchema, req.body);
        const result = await meetingJoin.joinSession(ref, ensureDeviceKey(req, res));
        const message =
            result.state === "PENDING" ? "Waiting for an organizer" : "Joined the session";
        return res.successResponse(result, message);
    });

    public static readonly postClaim = handle(async (req: Request, res: Response) => {
        const { ref } = validate(joinSchema, req.body);
        const credentials = await meetingJoin.claimCredentials(ref, readDeviceKey(req));

        return res.successResponse(credentials);
    });

    public static readonly postPersonaToken = handle(async (req: Request, res: Response) => {
        const { ref } = validate(joinSchema, req.body);
        const personaToken = await virtualAvatarPersona.mintPersonaToken(ref);

        return res.successResponse(personaToken, "Persona session token");
    });

    public static readonly postRawTranscript = handle(async (req: Request, res: Response) => {
        const { ref, attemptId, events } = validate(rawTranscriptSchema, req.body);
        const saved = await virtualAvatarPersona.saveRawTranscript(ref, attemptId, events);

        return res.successResponse(saved, "Raw transcript saved");
    });

    public static readonly postPersonaJoinLog = handle(async (req: Request, res: Response) => {
        const { ref, events } = validate(personaJoinLogSchema, req.body);
        const saved = await virtualAvatarPersona.savePersonaJoinLog(ref, events);

        return res.successResponse(saved, "Persona join log saved");
    });

    public static readonly postHostAgent = handle(async (req: Request, res: Response) => {
        const { ref } = validate(joinSchema, req.body);
        const handoff = await meetingJoin.hostAgent(ref);

        return res.successResponse(handoff, "Agent handoff");
    });

    public static readonly postRefresh =handle(async (req: Request, res: Response) => {
        const { ref } = validate(joinSchema, req.body);
        const credentials = await meetingJoin.refreshToken(ref, readDeviceKey(req));

        return res.successResponse(credentials);
    });

    public static readonly postLeave = handle(async (req: Request, res: Response) => {
        const { ref } = validate(joinSchema, req.body);
        const left = await meetingJoin.leaveSession(ref, readDeviceKey(req));

        return res.successResponse(left, "Left the session");
    });

    public static readonly getTranscript = handle(async (req: Request, res: Response) => {
        const { inviteToken } = validate(inviteTokenParamsSchema, req.params);
        const { meeting, participant } = await meetingJoin.requireInvite(inviteToken);
        const history = await transcript.history(meeting, participant);

        return res.successResponse(history);
    });

    public static readonly getTranscriptSpeech = handle(async (req: Request, res: Response) => {
        const { inviteToken, lineId } = validate(transcriptLineParamsSchema, req.params);
        const { meeting, participant } = await meetingJoin.requireInvite(inviteToken);
        const audio = await transcript.speech(meeting, participant, lineId);

        return res.set("Content-Type", "audio/mpeg").send(audio);
    });

    public static readonly postTranscriptLanguage = handle(async (req: Request, res: Response) => {
        const { ref, language } = validate(transcriptLanguageSchema, req.body);
        const { participant } = await meetingJoin.requireInvite(ref);
        if (!participant) throw new Error("Conflict: a shared link has no transcript language");
        const saved = await transcript.setLanguage(participant, language);

        return res.successResponse(saved, "Transcript language saved");
    });

    public static readonly postTranscription = handle(async (req: Request, res: Response) => {
        const { ref, status, language } = validate(transcriptionControlSchema, req.body);
        const { meeting } = await meetingJoin.requireOrganiser(ref);
        if (status === "ACTIVE") {
            await recording.startForMeeting(meeting, true);
            await meeting.reload();
        }
        const transcription = await transcript.control(meeting, { status, language });

        return res.successResponse({ transcription }, "Transcription updated");
    });
}

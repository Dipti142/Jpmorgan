import { Env } from "../../config/env.config";
import { trace, traceFailure } from "../../helpers/trace.helper";
import { AnamVideoQuality } from "../../interfaces/IAnamMeeting.interface";
import {
    IPersonaJoinLogEvent,
    IVirtualAvatarPersonaTokenView,
    VirtualAvatarScriptMode,
} from "../../interfaces/IVirtualAvatarSession.interface";
import {
    VA_CONDUCT,
    VA_CONVERSATION_SCRIPT,
    VA_NO_TOOLS,
    VA_TOOL_CALLING_RULES,
    VA_TOOL_USE,
} from "../../constants/virtualAvatar.text";
import { INTERVIEWER_CUES } from "../../constants/interview/interview.script";
import { INTERVIEW_TOOL_KEYS, SYSTEM_TOOL_KEYS } from "../../constants/interview/interview.tools";
import InterviewCall from "../../models/interviewCall.model";
import * as calls from "../interview/interviewCall.service";
import { CLOSING_BLOCKS, latestAnswers, recordedView, recordLifecycle } from "../interview/interview.service";
import { IScriptPlaceholders, IScriptQuestion } from "../../interfaces/IScript.interface";
import * as candidateRepo from "../../repositories/workable/candidate.repository";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import * as personaJoinLogRepo from "../../repositories/meeting/personaJoinLog.repository";
import { PERSONA_JOINED } from "../../repositories/interview/interviewCall.repository";
import * as vaRepo from "../../repositories/meeting/vaSchedule.repository";
import * as questionPatterns from "../../repositories/questionPattern.repository";
import { findPinnedAvatar, IResolvedPersona, pickAvatar, resolvePersona } from "../persona.service";
import { buildSystemPrompt } from "../prompt.service";
import { ScriptBuilderService } from "../scriptBuilder.service";
import { buildPersonaConfig } from "../anamSession.service";
import { createSessionToken } from "../anam.service";
import { assertJoinable, requireInvite } from "../meeting/meetingJoin.service";
import { IRawTranscriptEvent } from "../../interfaces/IInterviewCall.interface";

const candidateFor = async (meetingSessionId: number, reference: string) => {
    const participants = await meetingRepo.findParticipants(meetingSessionId);
    const matches = participants.filter((participant) => participant.role === "CANDIDATE");
    if (matches.length > 1) {
        trace("va-persona", reference, "multiple_candidates", { count: matches.length });
    }
    const participant = matches[0];
    if (!participant) return null;
    const candidate = participant.candidate_id
        ? await candidateRepo.findById(participant.candidate_id)
        : null;
    return { participant, candidate };
};

const resolveScript = async (
    companyId: number,
    jobShortCode: string | null,
    reference: string,
    placeholders: IScriptPlaceholders,
    scriptTemplateId?: number | null,
    isOngoing?: boolean,
    rejoining = false,
): Promise<{ script: string; mode: VirtualAvatarScriptMode; questions: IScriptQuestion[] }> => {
    try {
        const resolved = await ScriptBuilderService.resolve({
            companyId,
            programKind: "INTERVIEW",
            jobShortCode,
            scriptTemplateId,
            isOngoing,
            placeholders,
        });
        // Only the greeting goes in the prompt - every question is handed over by the tools.
        const script = ScriptBuilderService.renderOpening(resolved.sets, { rejoining, closing: CLOSING_BLOCKS });

        trace("va-persona", reference, "script_resolved", {
            mode: resolved.mode,
            jobShortCode: jobShortCode ?? "-",
            sets: resolved.sets.map((set) => `${set.key}:${set.pattern}`).join(","),
            questions: resolved.questions.length,
            rejoining,
            agent: placeholders.agent_name,
            candidate: placeholders.candidate_name,
            company: placeholders.company_name,
            // Only prints when one did not fill - a persona reading "[candidate_name]" aloud.
            unfilled: [...new Set(script.match(/\[(?:agent|company|candidate)_name\]/g) ?? [])].join(","),
        });

        return { script, mode: resolved.mode, questions: resolved.questions };
    } catch (error) {
        traceFailure("va-persona", reference, "script", error);
        return { script: VA_CONVERSATION_SCRIPT, mode: "conversation", questions: [] };
    }
};


const createAnamSession = async (input: {
    call: InterviewCall | null;
    isRetryOfOpenCall: boolean;
    meeting: Awaited<ReturnType<typeof requireInvite>>["meeting"];
    company: IResolvedPersona["company"];
    persona: IResolvedPersona["persona"];
    avatar: Awaited<ReturnType<typeof pickAvatar>>;
    systemPrompt: string;
    scripted: boolean;
}) => {
    try {
        const { personaConfig, toolNames } = await buildPersonaConfig({
            company: input.company,
            persona: input.persona,
            avatar: input.avatar,
            systemPrompt: input.systemPrompt,
            toolKeys: input.scripted ? INTERVIEW_TOOL_KEYS : [],
        });

        const sessionToken = await createSessionToken({
            personaConfig,
            sessionOptions: {
                videoQuality: Env.anam.video_quality as AnamVideoQuality,
                videoWidth: Env.anam.video_width,
                videoHeight: Env.anam.video_height,
            },
            clientLabel: input.meeting.uuid,
        });

        return { sessionToken, toolNames };
    } catch (error) {
        if (input.call) {
            await calls.recordCallFailure(input.call, {
                code: "SESSION_SETUP_FAILED",
                reason: "The avatar session could not be created",
                stage: "anam-session",
                error,
                closeAs: input.isRetryOfOpenCall ? undefined : "FAILED_TO_JOIN",
            });
        }
        throw error;
    }
};

const openOrResume = async (input: {
    open: InterviewCall | null;
    companyId: number;
    meetingSessionId: number;
    personaProgramId: number;
    reference: string;
    jobShortCode: string | null;
    questionsTotal: number;
    roomInitiatedTs: Date | null;
    systemPrompt: string;
    persona: IResolvedPersona["persona"];
    avatar: Awaited<ReturnType<typeof pickAvatar>>;
    company: IResolvedPersona["company"];
    program: IResolvedPersona["program"];
    interviewee: Awaited<ReturnType<typeof candidateFor>>;
}): Promise<InterviewCall> => {
    if (input.open) {
        await calls.updateCall(input.open, { questionsTotal: input.questionsTotal });
        return input.open;
    }

    return calls.openCall({
        companyId: input.companyId,
        meetingSessionId: input.meetingSessionId,
        personaProgramId: input.personaProgramId,
        interviewReference: input.reference,
        channel: "virtual_avatar",
        jobShortCode: input.jobShortCode,
        jobLabel: input.interviewee?.candidate?.job_title?.slice(0, 150) ?? null,
        roomInitiatedTs: input.roomInitiatedTs,
        ...(input.interviewee
            ? calls.candidateSnapshot(input.interviewee.participant, input.interviewee.candidate)
            : {}),
        personaKey: input.persona.personaKey,
        personaRole: input.persona.personaRole,
        anamAvatarId: Number(input.avatar.anam_avatar_id),
        avatarKey: input.avatar.avatar_key,
        avatarDisplayName: input.avatar.display_name,
        avatarModel: input.avatar.avatar_model,
        voiceId: input.avatar.voice_id,
        kbFolder: input.company.kb_folder,
        kbDomain: input.program.kb_domain,
        scriptHash: calls.hashScript(input.systemPrompt),
        questionsTotal: input.questionsTotal,
    });
};

export const mintPersonaToken = async (ref: string): Promise<IVirtualAvatarPersonaTokenView> => {
    const { meeting, participant } = await requireInvite(ref);
    assertJoinable(meeting);

    if (participant?.role !== "AGENT") {
        throw new Error("Conflict: only the AI agent participant has a persona");
    }
    if (participant.admission_state !== "ADMITTED") {
        throw new Error("Conflict: the persona has not been admitted to this session yet");
    }

    const companyId = Number(meeting.company_id);
    const meetingSessionId = Number(meeting.meeting_session_id);
    const { persona, program, company } = await resolvePersona(companyId, undefined, "INTERVIEW");

    const booking = await vaRepo.findByMeeting(meetingSessionId);
    if (booking?.meeting_status === "UNASSIGNED") {
        throw new Error("Conflict: no agent is assigned to this meeting");
    }

    const pinnedAvatar = booking?.avatar ?? (await findPinnedAvatar(meeting.persona_id));
    if (!booking && meeting.persona_id && !pinnedAvatar) {
        trace("va-persona", meeting.uuid, "persona_id_unresolved", { personaId: meeting.persona_id });
    }

    const avatar = await pickAvatar(persona, pinnedAvatar?.avatar_key);
    const personaProgramId = Number(program.persona_program_id);

    const interviewee = await candidateFor(meetingSessionId, meeting.uuid);
    
    const jobShortCode = interviewee?.candidate?.job_shortcode ?? meeting.job_short_code ?? null;

    const placeholders = ScriptBuilderService.placeholders({
        agentName: avatar.display_name,
        companyName: company.company_name,
        candidateName:
            interviewee?.participant.display_name ??
            interviewee?.candidate?.firstname ??
            interviewee?.candidate?.name,
    });

    const open = await calls.findOpenCall({ companyId, meetingSessionId, personaProgramId });
    const reference = open?.interview_reference ?? (await calls.generateReference(companyId));
    const rejoining = latestAnswers(open ? await calls.readAnswers(open) : []).size > 0;

    const { script, mode, questions } = await resolveScript(
        companyId,
        jobShortCode,
        meeting.uuid,
        placeholders,
        booking?.custom_script_template_id,
        booking?.meeting_status === "ONGOING",
        rejoining,
    );

    const scripted = mode !== "conversation";

    const subjectBrief = scripted
        ? `You are on a video call with ${meeting.joined_count} other participants. ` +
          `This interview's reference is ${reference} - you need it for everything you record.`
        : `You are on a video call with ${meeting.joined_count} other participants.`;

    const systemPrompt = buildSystemPrompt({
        characterPrompt: persona.characterPrompt,
        personaName: avatar.display_name,
        companyName: company.company_name,
        subjectBrief,
        roomConduct: VA_CONDUCT,
        script,
        toolUse: scripted ? VA_TOOL_USE : null,
        toolCallingRules: scripted ? VA_TOOL_CALLING_RULES : null,
        directorNotes: INTERVIEWER_CUES,
        extraGuardrails: scripted ? null : VA_NO_TOOLS,
    });

    // Anam's guide puts adherence degradation past about eight thousand tokens, and
    // nothing else measures what we send. Roughly four characters to the token.
    trace("va-persona", meeting.uuid, "prompt_size", {
        chars: systemPrompt.length,
        tokens: Math.round(systemPrompt.length / 4),
        mode,
    });

    // The prompt Anam is about to get, verbatim - the only place a call's full wording is readable.
    if (!Env.is_production) console.log(`[va-persona ${meeting.uuid}] system_prompt\n${systemPrompt}`);

    const call = scripted
        ? await openOrResume({
            open, companyId, meetingSessionId, personaProgramId, reference, jobShortCode,
            questionsTotal: questions.filter((question) => question.required).length,
            roomInitiatedTs: meeting.first_joined_ts,
            systemPrompt, persona, avatar, company, program,
            interviewee,
        })
        : null;
    if (call) await recordLifecycle(call, { tool: PERSONA_JOINED, outcome: open ? "rejoined" : "joined" });

    const { sessionToken, toolNames } = await createAnamSession({
        call,
        isRetryOfOpenCall: Boolean(open),
        meeting,
        company,
        persona,
        avatar,
        systemPrompt,
        scripted,
    });

    if (call) await calls.markPersonaJoined(call);

    await vaRepo.markStarted(meetingSessionId);

    trace("va-persona", meeting.uuid, "token_minted", {
        participantId: Number(participant.meeting_participant_id),
        avatar: avatar.avatar_key,
        speaksAs: avatar.display_name,
        script: mode,
        template: booking?.custom_script_template_id ?? "-",
        jobShortCode: jobShortCode ?? "-",
        reference: scripted ? reference : "-",
        tools: toolNames.length,
    });

    return { sessionToken, personaName: avatar.display_name, scriptMode: mode, jobShortCode, toolNames };
};

/** The questions this session's agent will ask. Expected answers are never returned. */
export const listSessionQuestions = async (ref: string) => {
    const { meeting, participant } = await requireInvite(ref);
    if (participant?.role !== "ORGANIZER" && participant?.role !== "AGENT") {
        throw new Error("Conflict: only an organizer or the AI agent can read this session's questions");
    }

    const companyId = Number(meeting.company_id);
    const meetingSessionId = Number(meeting.meeting_session_id);

    const [{ company }, booking, interviewee, patterns, call] = await Promise.all([
        resolvePersona(companyId, undefined, "INTERVIEW"),
        vaRepo.findByMeeting(meetingSessionId),
        candidateFor(meetingSessionId, meeting.uuid),
        questionPatterns.listPatterns(),
        calls.findLatestCall({ companyId, meetingSessionId }),
    ]);
    const recorded = latestAnswers(call ? await calls.readAnswers(call) : []);

    const jobShortCode = interviewee?.candidate?.job_shortcode ?? meeting.job_short_code ?? null;
    const avatar = booking?.avatar ?? (await findPinnedAvatar(meeting.persona_id));

    const { sets, mode } = await ScriptBuilderService.resolve({
        companyId,
        programKind: "INTERVIEW",
        jobShortCode,
        scriptTemplateId: booking?.custom_script_template_id,
        isOngoing: booking?.meeting_status === "ONGOING",
        placeholders: ScriptBuilderService.placeholders({
            agentName: avatar?.display_name,
            companyName: company.company_name,
            candidateName:
                interviewee?.participant.display_name ??
                interviewee?.candidate?.firstname ??
                interviewee?.candidate?.name,
        }),
    });

    const byCode = new Map(patterns.map((pattern) => [pattern.pattern_code, pattern]));
    const questionsTotal = sets.reduce((total, set) => total + set.questions.length, 0);

    trace("va-persona", meeting.uuid, "questions_read", {
        role: participant.role,
        mode,
        sets: sets.length,
        questions: questionsTotal,
    });

    return {
        sessionReference: meeting.uuid,
        scriptMode: mode,
        scriptTemplateId: booking?.custom_script_template_id ?? null,
        scheduleStatus: booking?.meeting_status ?? null,
        jobShortCode,
        questionsTotal,
        sets: sets.map((set) => ({
            key: set.key,
            title: set.title,
            questionPattern: set.pattern,
            patternLabel: byCode.get(set.pattern)?.pattern_label ?? set.pattern,
            patternOrder: byCode.get(set.pattern)?.display_order ?? set.order,
            order: set.order,
            ratingRequired: set.ratingRequired,
            questions: set.questions.map((question) => {
                const entry = recorded.get(question.key);

                return {
                    key: question.key,
                    title: question.title,
                    kind: question.kind,
                    order: question.order,
                    required: question.required,
                    question: question.question,
                    context: question.context ?? null,
                    captureFields: question.captureFields,
                    ratingRequired: question.ratingRequired,
                    recorded: entry ? recordedView(entry) : null,
                };
            }),
        })),
    };
};
const recordSystemToolCalls = async (
    call: InterviewCall,
    events: IRawTranscriptEvent[],
): Promise<void> => {
    for (const tool of SYSTEM_TOOL_KEYS) {
        const fired = events.find(
            (event) =>
                event.type === "TOOL_CALL_STARTED" &&
                (event.data as { toolName?: string } | undefined)?.toolName === tool,
        );
        if (!fired) continue;
        if (await calls.countToolCalls(call, tool)) continue;

        await recordLifecycle(call, {
            tool,
            outcome: "fired",
            detail: "Anam system tool, seen in the bridge event log",
            at: new Date(fired.at),
        });
    }
};

export const savePersonaJoinLog = async (
    ref: string,
    events: IPersonaJoinLogEvent[],
): Promise<{ saved: number }> => {
    const { meeting, participant } = await requireInvite(ref);

    if (participant?.role !== "AGENT") {
        throw new Error("Conflict: only the AI agent participant has a join log");
    }

    const saved = await personaJoinLogRepo.appendEvents({
        companyId: Number(meeting.company_id),
        meetingSessionId: Number(meeting.meeting_session_id),
        events,
    });

    const failure = events.find((event) => event.level === "ERROR");
    if (failure) {
        await calls.recordOpenCallFailure(Number(meeting.company_id), Number(meeting.meeting_session_id), {
            code: "PROVIDER_ERROR",
            reason: failure.message,
            stage: failure.stage,
            detail: failure.detail,
        });
    }

    return { saved };
};

export const saveRawTranscript = async (
    ref: string,
    attemptId: string,
    events: IRawTranscriptEvent[],
): Promise<{ saved: number }> => {
    const { meeting, participant } = await requireInvite(ref);

    if (participant?.role !== "AGENT") {
        throw new Error("Conflict: only the AI agent participant has a transcript");
    }

    const call = await calls.findLatestCall({
        companyId: Number(meeting.company_id),
        meetingSessionId: Number(meeting.meeting_session_id),
    });
    if (!call) throw new Error("No interview call recorded for this session");

    await calls.saveRawTranscript(call, attemptId, events);
    await recordSystemToolCalls(call, events);

    trace("va-persona", meeting.uuid, "raw_transcript_saved", {
        reference: call.interview_reference,
        attemptId,
        events: events.length,
    });

    return { saved: events.length };
};

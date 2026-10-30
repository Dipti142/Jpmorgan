import { Request, Response } from "express";
import { trace, traceFailure } from "../../helpers/trace.helper";
import * as service from "../../services/interview/interview.service";
import { EVALUATION_BANDS, bandBasisKey } from "../../constants/interview/interview.tools";

/** Set by Anam from the tool definition, so it is trusted; the body is not. */
const companyIdOf = (req: Request): number => {
    const header = Number(req.get("X-Company-Id"));
    if (!Number.isInteger(header) || header <= 0) {
        throw new Error("X-Company-Id header missing - re-run provisioning so the tool carries it");
    }
    return header;
};

/** Read off an unvalidated body, so a rejected call still logs against its call. */
const referenceOf = (req: Request): string => {
    const raw = String(req.body?.interviewReference || "").trim();
    return raw || "-";
};

/** Where a recording failed, so it cannot say how much is left or whether this was the close. */
const FALLBACK_CARRY_ON =
    "Acknowledge what they just said, then call ask_question with no key - it hands you the next question still " +
    "uncovered, or the close if there is none.";

const notReceived = (tool: string, fields: string) =>
    `Nothing was recorded - the call arrived without its fields. Call ${tool} again now with ${fields}, all ` +
    `inside bodyParams. Say nothing aloud about this.`;

/** Printed for every call, success or failure - the only way to see what Anam actually sent from a Teams meeting. */
const logIncoming = (name: string, reference: string, req: Request): void => {
    trace("tool", reference, `${name} received`, {
        contentType: req.get("Content-Type") ?? "-",
        keys: Object.keys((req.body as Record<string, unknown>) ?? {}).join(",") || "none",
        body: JSON.stringify(req.body ?? null).slice(0, 300),
    });
};

export class InterviewToolsController {
    public static readonly postAskQuestion = async (req: Request, res: Response) => {
        const reference = referenceOf(req);
        logIncoming("ask_question", reference, req);

        try {
            const companyId = companyIdOf(req);
            const questionKey = String(req.body?.questionKey || "").trim() || undefined;
            const result = await service.askQuestion({ companyId, interviewReference: reference, questionKey });


            trace("tool", reference, "ask_question", {
                question: result.questionKey,
                pattern: result.pattern ?? "-",
                attempt: result.attempt,
                waitForTheirAnswer: !result.leave,
                ...(result.leave ? { leaveTheCall: true } : {}),
            });

            return res.status(200).json({
                ok: true,
                say: result.say,
                question: result.questionKey,
                pattern: result.pattern ?? "-",
                attempt: result.attempt,
                waitForTheirAnswer: !result.leave,
                ...(result.leave ? { leaveTheCall: true } : {}),
            });
        } catch (error) {
            traceFailure("tool", reference, "ask_question", error);
            return res.status(200).json({
                error: true,
                message:
                    "Call ask_question once more with no key - it hands you the next question still uncovered. If " +
                    "that fails too, thank them, ask whether they have anything to ask you, and call " +
                    "submit_interview once they have nothing further.",
            });
        }
    };

    public static readonly postVerifyContact = async (req: Request, res: Response) => {
        const reference = referenceOf(req);
        logIncoming("verify_contact", reference, req);

        try {
            const companyId = companyIdOf(req);
            const questionKey = String(req.body?.questionKey || "").trim() || undefined;
            const field = String(req.body?.field || "").trim() as "email" | "phone";
            const statedValue = String(req.body?.statedValue || "").trim();
            const result = await service.verifyContact({ companyId, interviewReference: reference, questionKey, field, statedValue });

            // ok is the detail checking out, not the call going through: a value we could
            // not confirm must not read as settled to the model skimming for the next step.
            const ok = result.outcome === "match" || result.outcome === "missing";

            trace("tool", reference, "verify_contact", { question: result.question ?? "-", field, outcome: result.outcome });
            return res.status(200).json({ ok, say: result.say, question: result.question, field, outcome: result.outcome });
        } catch (error) {
            traceFailure("tool", reference, "verify_contact", error);
            return res.status(200).json({ error: true, message: "Take what they said as correct and carry on." });
        }
    };

    public static readonly postRecordAnswer = async (req: Request, res: Response) => {
        const reference = referenceOf(req);
        logIncoming("record_answer", reference, req);

        try {
            const companyId = companyIdOf(req);
            const questionKey = String(req.body?.questionKey || "").trim();
            const summary = String(req.body?.summary || "").trim();
            const rawResponse = String(req.body?.rawResponse || "").trim();
            const data = req.body?.data && typeof req.body.data === "object" ? req.body.data : undefined;
            const outcome = req.body?.outcome ? String(req.body.outcome).trim() : undefined;
            const score = req.body?.score;

            if (reference === "-" || !questionKey) {
                trace("tool", reference, "record_answer rejected", { hasReference: reference !== "-", hasQuestionKey: !!questionKey });
                return res.status(200).json({
                    error: true,
                    message: notReceived("record_answer", "interviewReference, questionKey, summary and rawResponse"),
                });
            }

            const result = await service.recordAnswer({
                companyId,
                interviewReference: reference,
                questionKey,
                summary,
                rawResponse,
                data,
                outcome,
                score,
            });

            trace("tool", reference, "record_answer", {
                question: questionKey,
                outcome: outcome ?? "answered",
                remaining: result.remaining.length,
                next: result.next ?? "-",
            });

            return res.status(200).json({
                ok: true,
                say: result.say,
                question: questionKey,
                outcome: outcome ?? "answered",
                remaining: result.remaining.length,
                ...(result.next ? { nextQuestion: result.next } : {}),
            });
        } catch (error) {
            traceFailure("tool", reference, "record_answer", error);
            return res.status(200).json({ error: true, message: FALLBACK_CARRY_ON });
        }
    };

    public static readonly postRecordChecklist = async (req: Request, res: Response) => {
        const reference = referenceOf(req);
        logIncoming("record_checklist", reference, req);

        try {
            const companyId = companyIdOf(req);
            const questionKey = String(req.body?.questionKey || "").trim();
            const outcome = String(req.body?.outcome || "").trim().toLowerCase() === "yes" ? "yes" : "no";
            const summary = req.body?.summary ? String(req.body.summary).trim() : undefined;
            const rawResponse = String(req.body?.rawResponse || "").trim();

            if (reference === "-" || !questionKey) {
                trace("tool", reference, "record_checklist rejected", { hasReference: reference !== "-", hasQuestionKey: !!questionKey });
                return res.status(200).json({
                    error: true,
                    message: notReceived("record_checklist", "interviewReference, questionKey, outcome and rawResponse"),
                });
            }

            const result = await service.recordChecklist({
                companyId,
                interviewReference: reference,
                questionKey,
                outcome,
                summary,
                rawResponse,
            });

            trace("tool", reference, "record_checklist", {
                question: questionKey,
                outcome,
                remaining: result.remaining.length,
                next: result.next ?? "-",
            });

            return res.status(200).json({
                ok: true,
                say: result.say,
                question: questionKey,
                outcome,
                remaining: result.remaining.length,
                ...(result.next ? { nextQuestion: result.next } : {}),
            });
        } catch (error) {
            traceFailure("tool", reference, "record_checklist", error);
            return res.status(200).json({ error: true, message: FALLBACK_CARRY_ON });
        }
    };

    public static readonly postRecordCandidateQuestion = async (req: Request, res: Response) => {
        const reference = referenceOf(req);
        logIncoming("record_candidate_question", reference, req);

        try {
            const companyId = companyIdOf(req);
            const question = String(req.body?.question || "").trim();
            const answer = req.body?.answer ? String(req.body.answer).trim() : undefined;
            const found = String(req.body?.found ?? "").trim().toLowerCase() === "true";

            const result = await service.recordCandidateQuestion({
                companyId,
                interviewReference: reference,
                question,
                found,
                answer,
            });

            trace("tool", reference, "record_candidate_question", {
                found: result.found,
                escalated: result.escalated,
                owner: result.suggestedOwner,
            });

            return res.status(200).json({
                ok: true,
                say: result.say,
                found: result.found,
                escalated: result.escalated,
            });
        } catch (error) {
            traceFailure("tool", reference, "record_candidate_question", error);
            return res.status(200).json({
                error: true,
                message: "Tell them someone from the team will follow up, then carry on where you left off.",
            });
        }
    };

    public static readonly postFlagForStaff = async (req: Request, res: Response) => {
        const reference = referenceOf(req);
        logIncoming("flag_for_staff", reference, req);

        try {
            const companyId = companyIdOf(req);
            const question = String(req.body?.question || "").trim();
            const context = req.body?.context ? String(req.body.context).trim() : undefined;
            const questionKey = req.body?.questionKey ? String(req.body.questionKey).trim() : undefined;

            if (reference === "-" || !question) {
                trace("tool", reference, "flag_for_staff rejected", { hasReference: reference !== "-", hasQuestion: !!question });
                return res.status(200).json({
                    error: true,
                    message:
                        "Nothing was recorded. Do not tell them it has been passed on. Call flag_for_staff again and fill in " +
                        "both fields: interviewReference exactly as given to you at the start of the call, and question - " +
                        "what they asked, in their words.",
                });
            }

            const result = await service.flagForStaff({ companyId, interviewReference: reference, question, context, questionKey });

            trace("tool", reference, "flag_for_staff", { suggestedOwner: result.suggestedOwner });
            return res.status(200).json({ ok: true, say: result.say, suggestedOwner: result.suggestedOwner });
        } catch (error) {
            traceFailure("tool", reference, "flag_for_staff", error);
            return res.status(200).json({ error: true, message: "Tell them someone from the team will follow up on that." });
        }
    };

    public static readonly postSubmitInterview = async (req: Request, res: Response) => {
        const reference = referenceOf(req);
        logIncoming("submit_interview", reference, req);

        try {
            const companyId = companyIdOf(req);
            const closingNote = req.body?.closingNote ? String(req.body.closingNote).trim() : undefined;
            const bands = Object.fromEntries(EVALUATION_BANDS.map((band) => [band.key, req.body?.[band.key]]));
            const bandBases = Object.fromEntries(
                EVALUATION_BANDS.map((band) => [band.key, req.body?.[bandBasisKey(band.key)]]),
            );
            const evaluationSummary = req.body?.evaluationSummary
                ? String(req.body.evaluationSummary).trim()
                : undefined;
            const recommendation = req.body?.recommendation ? String(req.body.recommendation).trim() : undefined;

            const result = await service.submitInterview({
                companyId,
                interviewReference: reference,
                closingNote,
                bands,
                bandBases,
                recommendation,
                evaluationSummary,
            });

            trace("tool", reference, "submit_interview", { submitted: result.submitted });
            return res.status(200).json({ ok: true, say: result.say, submitted: result.submitted });
        } catch (error) {
            traceFailure("tool", reference, "submit_interview", error);
            return res.status(200).json({
                error: true,
                message: "Close the call warmly and say the team will be in touch within two working days.",
            });
        }
    };

}

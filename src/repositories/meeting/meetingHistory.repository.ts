import { Op, Transaction } from "sequelize";
import { traceFailure } from "../../helpers/trace.helper";
import { IMeetingScope, ITimelineError, TimelineDraft } from "../../interfaces/IMeetingTimeline.interface";
import connection from "../../models/index";
import MeetingHistory from "../../models/meetingHistory.model";
import MeetingHistoryEvent from "../../models/meetingHistoryEvent.model";

interface IAppendInput {
    companyId: number;
    meetingSessionId: number;
    interviewCallId?: number | null;
    draft: TimelineDraft;
}

const failureOf = (draft: TimelineDraft): Pick<ITimelineError, "error_code" | "error_message"> | null =>
    draft.outcome === "FAILED" ? draft : null;

const eventRowOf = (input: IAppendInput) => {
    const { draft } = input;
    const failure = failureOf(draft);

    return {
        company_id: input.companyId,
        meeting_session_id: input.meetingSessionId,
        occurred_ts: new Date(draft.occurred_ts),
        track: draft.track,
        provider: draft.provider,
        event_type: draft.event_type,
        outcome: draft.outcome,
        from_status: draft.from_status ?? null,
        to_status: draft.to_status ?? null,
        actor_type: draft.actor?.type ?? null,
        actor_id: draft.actor?.id ?? null,
        message: draft.message,
        note: draft.note ?? null,
        error_code: failure?.error_code ?? null,
        error_message: failure?.error_message ?? null,
        details: draft.details,
    };
};

const summaryWhere = (scope: IMeetingScope) => ({
    company_id: scope.companyId,
    meeting_session_id: scope.meetingSessionId,
});

const updateSummary = async (input: IAppendInput, transaction: Transaction): Promise<void> => {
    const where = summaryWhere(input);
    const [row] = await MeetingHistory.findOrCreate({ where, defaults: where, transaction });

    if (input.interviewCallId && row.interview_call_id !== input.interviewCallId) {
        await row.update({ interview_call_id: input.interviewCallId }, { transaction });
    }
};

export const findSummary = async (companyId: number, meetingSessionId: number): Promise<MeetingHistory | null> =>
    MeetingHistory.findOne({ where: summaryWhere({ companyId, meetingSessionId }) });

export const findOutlineByMeeting = async (
    companyId: number,
    meetingSessionId: number,
): Promise<MeetingHistoryEvent[]> =>
    MeetingHistoryEvent.findAll({
        attributes: ["meeting_history_event_id", "outcome", "track", "provider"],
        where: { company_id: companyId, meeting_session_id: meetingSessionId },
        order: [["meeting_history_event_id", "ASC"]],
    });

export const findEventsByIds = async (
    companyId: number,
    meetingSessionId: number,
    eventIds: number[],
): Promise<MeetingHistoryEvent[]> =>
    MeetingHistoryEvent.findAll({
        where: {
            company_id: companyId,
            meeting_session_id: meetingSessionId,
            meeting_history_event_id: { [Op.in]: eventIds },
        },
        order: [["meeting_history_event_id", "DESC"]],
    });

export const appendEntry = async (input: IAppendInput): Promise<void> =>
    connection.transaction(async (transaction) => {
        await MeetingHistoryEvent.create(eventRowOf(input), { transaction });
        await updateSummary(input, transaction);
    });

export const tryAppendEntry = async (input: IAppendInput & { reference?: string }): Promise<void> => {
    const reference = input.reference ?? String(input.meetingSessionId);

    try {
        await appendEntry(input);
    } catch (error) {
        traceFailure(
            "history",
            reference,
            `NOT_RECORDED track=${input.draft.track} event=${input.draft.event_type} outcome=${input.draft.outcome}`,
            error,
        );
    }
};

const saveFinalStatus = async (scope: IMeetingScope, finalStatus: string): Promise<void> => {
    const where = summaryWhere(scope);
    const [row] = await MeetingHistory.findOrCreate({ where, defaults: { ...where, final_status: finalStatus } });
    if (row.final_status !== finalStatus) await row.update({ final_status: finalStatus });
};

export const tryRecordFinalStatus = async (scopes: IMeetingScope[], finalStatus: string): Promise<void> => {
    try {
        await Promise.all(scopes.map((scope) => saveFinalStatus(scope, finalStatus)));
    } catch (error) {
        traceFailure(
            "history",
            scopes.map((scope) => scope.meetingSessionId).join(","),
            `FINAL_STATUS_NOT_RECORDED status=${finalStatus}`,
            error,
        );
    }
};

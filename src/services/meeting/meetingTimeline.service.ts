import {
    IMeetingHistoryEntryView,
    IMeetingHistoryQuery,
    IMeetingHistorySummary,
    IMeetingHistoryView,
    TimelineTrack,
} from "../../interfaces/IMeetingTimeline.interface";
import MeetingHistoryEvent from "../../models/meetingHistoryEvent.model";
import * as historyRepo from "../../repositories/meeting/meetingHistory.repository";
import { requireMeeting } from "./meetingSession.service";

const idOf = (row: MeetingHistoryEvent): number => Number(row.meeting_history_event_id);

const laneOf = (row: MeetingHistoryEvent): string => `${row.track}|${row.provider}`;

const isRecovery = (row: MeetingHistoryEvent): boolean => row.outcome === "OK" || row.outcome === "RETRIED";

const stepsOf = (outline: MeetingHistoryEvent[]): Map<number, number> =>
    new Map(outline.map((row, index) => [idOf(row), index + 1]));

const openFailureIds = (outline: MeetingHistoryEvent[]): Set<number> => {
    const recoveredLanes = new Set<string>();
    const open = new Set<number>();

    for (let index = outline.length - 1; index >= 0; index -= 1) {
        const row = outline[index];
        if (isRecovery(row)) recoveredLanes.add(laneOf(row));
        else if (row.outcome === "FAILED" && !recoveredLanes.has(laneOf(row))) open.add(idOf(row));
    }

    return open;
};

const summaryOf = (outline: MeetingHistoryEvent[], open: Set<number>): IMeetingHistorySummary => {
    const failures = outline.filter((row) => row.outcome === "FAILED");

    return {
        total: outline.length,
        failed: failures.length,
        openFailures: open.size,
        failedTracks: [...new Set(failures.map((row) => row.track))] as TimelineTrack[],
    };
};

const entryView = (row: MeetingHistoryEvent, step: number, open: Set<number>): IMeetingHistoryEntryView => ({
    step,
    occurredAt: row.occurred_ts.toISOString(),
    track: row.track,
    provider: row.provider,
    eventType: row.event_type,
    outcome: row.outcome,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorType: row.actor_type,
    actorId: row.actor_id,
    message: row.message,
    note: row.note,
    details: row.details,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    open: row.outcome === "FAILED" ? open.has(idOf(row)) : null,
});

export const getMeetingHistory = async (
    companyId: number,
    reference: string,
    query: IMeetingHistoryQuery,
): Promise<IMeetingHistoryView> => {
    const meeting = await requireMeeting(companyId, reference);
    const meetingSessionId = Number(meeting.meeting_session_id);

    const outline = await historyRepo.findOutlineByMeeting(companyId, meetingSessionId);
    const summaryRow = await historyRepo.findSummary(companyId, meetingSessionId);

    const steps = stepsOf(outline);
    const open = openFailureIds(outline);
    const matching = query.outcome ? outline.filter((row) => row.outcome === query.outcome) : outline;

    const pageIds = matching
        .map(idOf)
        .reverse()
        .slice(query.offset, query.offset + query.limit);
    const rows = pageIds.length ? await historyRepo.findEventsByIds(companyId, meetingSessionId, pageIds) : [];

    return {
        sessionReference: meeting.uuid,
        finalStatus: summaryRow?.final_status ?? null,
        summary: summaryOf(outline, open),
        total: matching.length,
        limit: query.limit,
        offset: query.offset,
        entries: rows.map((row) => entryView(row, steps.get(idOf(row)) as number, open)),
    };
};

import { Op, Transaction, WhereOptions } from "sequelize";
import { MeetingStatus, VaScheduleStatus } from "../../interfaces/IMeeting.interface";
import AnamAvatar from "../../models/anamAvatar.model";
import connection from "../../models/index";
import InterviewCall from "../../models/interviewCall.model";
import MeetingSession from "../../models/meetingSession.model";
import VaCalendarBlock from "../../models/vaCalendarBlock.model";
import VaScheduled from "../../models/vaScheduled.model";
import * as applicationRepo from "./applicationDetails.repository";
import * as historyRepo from "./meetingHistory.repository";
import * as vaMeetingStatusRepo from "./vaMeetingStatus.repository";

const HOLDING: VaScheduleStatus[] = ["SCHEDULED", "ONGOING"];
const FINAL_MEETING_STATUSES: MeetingStatus[] = ["ENDED", "EXPIRED", "REVOKED", "CANCELLED"];

export const findByMeeting = async (
    meetingSessionId: number,
    transaction?: Transaction,
): Promise<VaScheduled | null> =>
    VaScheduled.findOne({
        where: { meeting_session_id: meetingSessionId },
        include: [{ model: AnamAvatar, as: "avatar" }],
        transaction,
    });

export const listHolding = async (
    from: Date,
    to?: Date,
    transaction?: Transaction,
): Promise<VaScheduled[]> =>
    VaScheduled.findAll({
        where: {
            meeting_status: { [Op.in]: HOLDING },
            anam_avatar_id: { [Op.ne]: null },
            occupancy_end: { [Op.gt]: from },
            ...(to ? { occupancy_start: { [Op.lt]: to } } : {}),
        },
        transaction,
    });

export const listUnbookedMeetings = async (now: Date): Promise<MeetingSession[]> => {
    const meetings = await MeetingSession.findAll({ where: { start_time: { [Op.gt]: now } } });
    const booked = await VaScheduled.findAll({
        attributes: ["meeting_session_id"],
        where: { meeting_session_id: meetings.map((meeting) => meeting.meeting_session_id) },
    });
    const bookedIds = new Set(booked.map((row) => Number(row.meeting_session_id)));

    return meetings.filter((meeting) => !bookedIds.has(Number(meeting.meeting_session_id)));
};

interface IScheduleChange {
    meeting_status: VaScheduleStatus;
    started_ts?: Date;
    completed_ts?: Date;
    cancelled_ts?: Date;
    cancel_reason?: string;
}

const syncMeetingStatus = async (
    meetingSessionIds: number[],
    scheduleStatus: VaScheduleStatus,
    transaction: Transaction,
): Promise<void> => {
    if (!meetingSessionIds.length) return;

    const meetingStatus = await vaMeetingStatusRepo.findMeetingStatusFor(scheduleStatus, transaction);
    if (!meetingStatus) return;

    const closing = FINAL_MEETING_STATUSES.includes(meetingStatus);

    await MeetingSession.update(
        {
            meeting_status: meetingStatus,
            ...(closing ? { ended_ts: new Date(), end_reason: `SCHEDULE_${scheduleStatus}` } : {}),
        },
        {
            where: {
                meeting_session_id: { [Op.in]: meetingSessionIds },
                meeting_status: { [Op.notIn]: FINAL_MEETING_STATUSES },
            },
            transaction,
        },
    );
};

const endMeetingSessions = async (
    meetingSessionIds: number[],
    reason: string,
    transaction: Transaction,
): Promise<void> => {
    if (!meetingSessionIds.length) return;

    await MeetingSession.update(
        { meeting_status: "ENDED", ended_ts: new Date(), end_reason: reason },
        {
            where: {
                meeting_session_id: { [Op.in]: meetingSessionIds },
                meeting_status: { [Op.notIn]: FINAL_MEETING_STATUSES },
            },
            transaction,
        },
    );
};

const changeSchedule = async (
    change: IScheduleChange,
    where: WhereOptions<VaScheduled>,
    options: { endsMeeting?: boolean } = {},
): Promise<void> => {
    const changed = await connection.transaction(async (transaction) => {
        const [, changedRows] = await VaScheduled.update(change, { where, returning: true, transaction });
        const meetingSessionIds = changedRows.map((row) => Number(row.meeting_session_id));
        await syncMeetingStatus(meetingSessionIds, change.meeting_status, transaction);
        if (options.endsMeeting) {
            await endMeetingSessions(meetingSessionIds, `SCHEDULE_${change.meeting_status}`, transaction);
        }
        await applicationRepo.updateStatusForMeetings(meetingSessionIds, change.meeting_status, transaction);
        return changedRows;
    });

    await historyRepo.tryRecordFinalStatus(
        changed.map((row) => ({ companyId: Number(row.company_id), meetingSessionId: Number(row.meeting_session_id) })),
        change.meeting_status,
    );
};

const endElapsedInterruptedSessions = async (elapsedBy: Date): Promise<void> => {
    const stillOpen = await MeetingSession.findAll({
        attributes: ["meeting_session_id"],
        where: { meeting_status: { [Op.notIn]: FINAL_MEETING_STATUSES }, end_time: { [Op.lte]: elapsedBy } },
    });
    if (!stillOpen.length) return;

    const interrupted = await VaScheduled.findAll({
        attributes: ["meeting_session_id"],
        where: {
            meeting_session_id: { [Op.in]: stillOpen.map((meeting) => Number(meeting.meeting_session_id)) },
            meeting_status: "INTERRUPTED",
            occupancy_end: { [Op.lte]: elapsedBy },
        },
    });
    if (!interrupted.length) return;

    await MeetingSession.update(
        { meeting_status: "ENDED", ended_ts: new Date(), end_reason: "SCHEDULE_INTERRUPTED" },
        {
            where: {
                meeting_session_id: { [Op.in]: interrupted.map((row) => Number(row.meeting_session_id)) },
                meeting_status: { [Op.notIn]: FINAL_MEETING_STATUSES },
            },
        },
    );
};

const findSubmitted = async (meetingSessionIds: number[]): Promise<Set<number>> => {
    if (!meetingSessionIds.length) return new Set();

    const calls = await InterviewCall.findAll({
        attributes: ["meeting_session_id"],
        where: { meeting_session_id: { [Op.in]: meetingSessionIds }, call_status: "COMPLETED" },
    });
    return new Set(calls.map((call) => Number(call.meeting_session_id)));
};

export const markStarted = async (meetingSessionId: number): Promise<void> => {
    await changeSchedule(
        { meeting_status: "ONGOING", started_ts: new Date() },
        { meeting_session_id: meetingSessionId, meeting_status: "SCHEDULED" },
    );
    await changeSchedule(
        { meeting_status: "ONGOING" },
        { meeting_session_id: meetingSessionId, meeting_status: "INTERRUPTED" },
    );
};

export const markInterrupted = async (meetingSessionId: number): Promise<void> => {
    const submitted = await findSubmitted([meetingSessionId]);
    if (submitted.has(meetingSessionId)) return;

    await changeSchedule(
        { meeting_status: "INTERRUPTED" },
        { meeting_session_id: meetingSessionId, meeting_status: "ONGOING" },
    );
};

export const markCompletedIfSubmitted = async (meetingSessionId: number): Promise<boolean> => {
    const submitted = await findSubmitted([meetingSessionId]);
    if (!submitted.has(meetingSessionId)) return false;

    await changeSchedule(
        { meeting_status: "COMPLETED", completed_ts: new Date() },
        { meeting_session_id: meetingSessionId, meeting_status: "ONGOING" },
    );
    return true;
};

export const markFinished = async (
    scope: { meetingSessionId: number } | { elapsedBy: Date },
): Promise<void> => {
    const where: WhereOptions<VaScheduled> =
        "meetingSessionId" in scope
            ? { meeting_session_id: scope.meetingSessionId }
            : { occupancy_end: { [Op.lte]: scope.elapsedBy } };
    const completedTs = new Date();

    const ongoing = await VaScheduled.findAll({
        attributes: ["meeting_session_id"],
        where: { ...where, meeting_status: "ONGOING" },
    });
    const ongoingIds = ongoing.map((row) => Number(row.meeting_session_id));
    const submitted = await findSubmitted(ongoingIds);

    const unsubmittedIds = ongoingIds.filter((id) => !submitted.has(id));

    if (submitted.size) {
        await changeSchedule(
            { meeting_status: "COMPLETED", completed_ts: completedTs },
            { meeting_session_id: { [Op.in]: [...submitted] }, meeting_status: "ONGOING" },
        );
    }
    if (unsubmittedIds.length) {
        await changeSchedule(
            { meeting_status: "INTERRUPTED" },
            { meeting_session_id: { [Op.in]: unsubmittedIds }, meeting_status: "ONGOING" },
            { endsMeeting: true },
        );
    }
    if ("elapsedBy" in scope) await endElapsedInterruptedSessions(scope.elapsedBy);

    await changeSchedule(
        { meeting_status: "MISSED", completed_ts: completedTs },
        { ...where, meeting_status: { [Op.in]: ["UNASSIGNED", "SCHEDULED"] } },
    );
};

export const markCancelled = async (meetingSessionId: number, reason: string): Promise<void> => {
    await changeSchedule(
        { meeting_status: "CANCELLED", cancelled_ts: new Date(), cancel_reason: reason },
        {
            meeting_session_id: meetingSessionId,
            meeting_status: { [Op.in]: ["UNASSIGNED", "SCHEDULED", "ONGOING", "INTERRUPTED"] },
        },
    );
};

export const setEnd = async (
    meetingSessionId: number,
    input: { endTime: Date; occupancyEnd: Date },
): Promise<void> => {
    await VaScheduled.update(
        { end_time: input.endTime, occupancy_end: input.occupancyEnd },
        { where: { meeting_session_id: meetingSessionId, meeting_status: { [Op.in]: HOLDING } } },
    );
};

export const listLiveBlocks = async (now: Date): Promise<VaCalendarBlock[]> =>
    VaCalendarBlock.findAll({ where: { end_ts: { [Op.gt]: now } } });

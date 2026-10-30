import crypto from "node:crypto";
import { Env } from "../../config/env.config";
import {
    MINUTE_MS,
    isFinal,
    mergeWindows,
    occupancyOf,
    sameSchedule,
    saturatedWindows,
    scheduleFrom,
    scheduleOf,
} from "../../helpers/meeting.helper";
import { trace, traceFailure } from "../../helpers/trace.helper";
import { IMeetingWindow } from "../../interfaces/IMeeting.interface";
import AnamAvatar from "../../models/anamAvatar.model";
import connection from "../../models/index";
import VaCalendarBlock from "../../models/vaCalendarBlock.model";
import VaScheduled from "../../models/vaScheduled.model";
import * as customScripts from "../../repositories/customScript.repository";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import * as applications from "./applicationDetails.service";
import * as vaRepo from "../../repositories/meeting/vaSchedule.repository";
import { createBlockEvent, eventsPath } from "../teamsCalendar.service";
import { del } from "../teamsGraph.service";

const DAY_MS = 24 * 60 * MINUTE_MS;

const dayKeyOf = (at: Date): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone: Env.meeting.MEETING_BLOCK_TIMEZONE }).format(at);

const dayEndOf = (dayKey: string): Date => {
    const nextMidnightUtc = Date.parse(`${dayKey}T00:00:00Z`) + DAY_MS;
    const offset = new Intl.DateTimeFormat("en-US", {
        timeZone: Env.meeting.MEETING_BLOCK_TIMEZONE,
        timeZoneName: "longOffset",
    })
        .formatToParts(nextMidnightUtc)
        .find((part) => part.type === "timeZoneName")?.value;
    const [, sign, hours, minutes] = /([+-])(\d{2}):(\d{2})/.exec(offset ?? "") ?? ["", "+", "0", "0"];

    return new Date(nextMidnightUtc - Number(`${sign}1`) * (Number(hours) * 60 + Number(minutes)) * MINUTE_MS);
};

const timeOf = (at: Date): string =>
    new Intl.DateTimeFormat("en-GB", {
        timeZone: Env.meeting.MEETING_BLOCK_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
    }).format(at);

const keyOf = (window: IMeetingWindow): string =>
    `${window.startsAt.toISOString()}/${window.endsAt.toISOString()}`;

export const bookMeeting = async (
    meetingSessionId: number,
    workableEventId: string | null = null,
): Promise<void> => {
    const meeting = await meetingRepo.findById(meetingSessionId);
    if (!meeting || isFinal(meeting)) return;

    const schedule = scheduleOf(meeting);
    const occupancy = occupancyOf(schedule);
    const participants = await meetingRepo.findParticipants(meetingSessionId);
    const candidateId =
        participants.find((participant) => participant.role === "CANDIDATE" && participant.candidate_id)
            ?.candidate_id ?? null;
    const applicant = await applications.loadApplicant(participants, candidateId);
    const pinned = meeting.job_short_code
        ? await customScripts.findScriptForRole({
            companyId: Number(meeting.company_id),
            programKind: "INTERVIEW",
            participantRole: "AGENT",
            jobShortCode: meeting.job_short_code,
        })
        : null;

    const booking = await connection.transaction(async (transaction) => {
        const avatars = await AnamAvatar.findAll({
            where: { is_active: 1 },
            order: [["display_order", "ASC"]],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        const existing = await vaRepo.findByMeeting(meetingSessionId, transaction);
        const rescheduled =
            !!existing && !sameSchedule(scheduleFrom(existing.start_time, existing.end_time), schedule);

        if (
            existing &&
            (existing.meeting_status === "CANCELLED" ||
                existing.meeting_status === "COMPLETED" ||
                ((existing.meeting_status === "MISSED" || existing.meeting_status === "INTERRUPTED") &&
                    !rescheduled))
        ) {
            await applications.recordBooking(existing, applicant, transaction);
            return existing;
        }

        const busy = new Set(
            (await vaRepo.listHolding(occupancy.startsAt, occupancy.endsAt, transaction))
                .filter((row) => Number(row.meeting_session_id) !== meetingSessionId)
                .map((row) => Number(row.anam_avatar_id)),
        );
        const free = avatars.filter((avatar) => !busy.has(Number(avatar.anam_avatar_id)));
        const avatar =
            free.find((candidate) => Number(candidate.anam_avatar_id) === Number(existing?.anam_avatar_id)) ??
            free[0] ??
            null;

        const values = {
            company_id: meeting.company_id,
            meeting_session_id: meetingSessionId,
            ics_uid: meeting.ics_uid,
            workable_event_id: workableEventId ?? existing?.workable_event_id ?? null,
            candidate_id: candidateId,
            job_short_code: meeting.job_short_code,
            topic: meeting.topic,
            schedule_date: dayKeyOf(schedule.startsAt),
            start_time: schedule.startsAt,
            end_time: schedule.endsAt,
            occupancy_start: occupancy.startsAt,
            occupancy_end: occupancy.endsAt,
            reschedule_count: (existing?.reschedule_count ?? 0) + (rescheduled ? 1 : 0),
            ...(existing?.meeting_status === "ONGOING"
                ? {}
                : {
                    anam_avatar_id: avatar?.anam_avatar_id ?? null,
                    persona_name: avatar?.display_name ?? null,
                    custom_script_template_id: pinned?.custom_script_template_id ?? null,
                    meeting_status: avatar ? "SCHEDULED" : "UNASSIGNED",
                    started_ts: null,
                    completed_ts: null,
                }),
        };

        const saved = existing
            ? await existing.update(values, { transaction })
            : await VaScheduled.create(values, { transaction });
        await applications.recordBooking(saved, applicant, transaction);
        return saved;
    });

    await applications.fillJobDetails(meetingSessionId);

    trace("va-schedule", meeting.uuid, "booked", {
        status: booking.meeting_status,
        persona: booking.persona_name ?? "-",
        date: booking.schedule_date,
        startsAt: booking.start_time.toISOString(),
        template: booking.custom_script_template_id ?? "default",
        rescheduled: booking.reschedule_count,
    });

    void syncBlocks();
};

const publishBlocks = async (): Promise<void> => {
    const now = new Date();
    const threshold = await AnamAvatar.count({ where: { is_active: 1 } });
    const rows = await vaRepo.listHolding(now);
    const agents = [...new Set(rows.map((row) => Number(row.anam_avatar_id)))];
    const saturated = saturatedWindows(
        agents.flatMap((agent) =>
            mergeWindows(
                rows
                    .filter((row) => Number(row.anam_avatar_id) === agent)
                    .map((row) => ({ startsAt: row.occupancy_start, endsAt: row.occupancy_end })),
            ),
        ),
        threshold,
    );
    const windows =
        Env.meeting.MEETING_BLOCK_PUBLISH_MODE === "dilated"
            ? mergeWindows(saturated.map(occupancyOf))
            : saturated;

    const wanted = windows
        .flatMap((window) => {
            const pieces: (IMeetingWindow & { blockDate: string })[] = [];
            for (let startsAt = window.startsAt; startsAt < window.endsAt; ) {
                const blockDate = dayKeyOf(startsAt);
                const endsAt = new Date(Math.min(window.endsAt.getTime(), dayEndOf(blockDate).getTime()));
                pieces.push({ blockDate, startsAt, endsAt });
                startsAt = endsAt;
            }
            return pieces;
        })
        .filter((piece) => piece.endsAt > now);

    const wantedKeys = new Set(wanted.map(keyOf));
    const published = new Map(
        (await vaRepo.listLiveBlocks(now)).map((block) => [
            keyOf({ startsAt: block.start_ts, endsAt: block.end_ts }),
            block,
        ]),
    );

    for (const [key, block] of published) {
        if (wantedKeys.has(key)) continue;

        await del(`${eventsPath()}/${block.graph_event_id}`).catch((error) => {
            if (![400, 404].includes(error?.response?.status)) throw error;
        });
        await block.destroy();
        trace("va-schedule", block.block_date, "block_removed", { window: key });
    }

    for (const piece of wanted) {
        const key = keyOf(piece);
        if (published.has(key)) continue;

        const booked = rows
            .filter((row) => row.occupancy_start < piece.endsAt && row.occupancy_end > piece.startsAt)
            .sort((a, b) => a.start_time.getTime() - b.start_time.getTime());
        const event = await createBlockEvent({
            startsAt: piece.startsAt,
            endsAt: piece.endsAt,
            subject: `Agents fully booked: ${[...new Set(booked.map((row) => row.persona_name))].join(", ")}`,
            body: [
                `All ${threshold} agents are booked from ${timeOf(piece.startsAt)} to ${timeOf(piece.endsAt)} ` +
                    `(${Env.meeting.MEETING_BLOCK_TIMEZONE}), so no new interview can be taken in this window.`,
                "",
                ...booked.map(
                    (row) =>
                        `${row.persona_name}: ${timeOf(row.start_time)}-${timeOf(row.end_time)} ${row.topic ?? ""} ` +
                        `(job ${row.job_short_code ?? "-"}, candidate ${row.candidate_id ?? "-"})`,
                ),
            ].join("\n"),
            transactionId: crypto.createHash("sha256").update(`${piece.blockDate}/${key}`).digest("hex"),
        });
        await VaCalendarBlock.create({
            block_date: piece.blockDate,
            start_ts: piece.startsAt,
            end_ts: piece.endsAt,
            graph_event_id: event.id,
            synced_ts: new Date(),
        });
        trace("va-schedule", piece.blockDate, "block_published", { window: key, agents: booked.length });
    }
};

let blockSync: Promise<void> = Promise.resolve();

export const syncBlocks = (): Promise<void> => {
    blockSync = blockSync
        .then(publishBlocks)
        .catch((error) => traceFailure("va-schedule", "blocks", "sync", error));
    return blockSync;
};

let sweeping = false;

export const sweep = async (): Promise<void> => {
    if (sweeping) return;
    sweeping = true;

    try {
        const now = new Date();
        await vaRepo.markFinished({ elapsedBy: now });

        for (const meeting of await vaRepo.listUnbookedMeetings(now)) {
            await bookMeeting(Number(meeting.meeting_session_id)).catch((error) =>
                traceFailure("va-schedule", meeting.uuid, "book", error),
            );
        }

        await syncBlocks();
    } finally {
        sweeping = false;
    }
};

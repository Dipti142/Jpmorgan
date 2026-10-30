import crypto from "node:crypto";
import { Env } from "../config/env.config";
import { IMeetingWindow, MeetingStatus } from "../interfaces/IMeeting.interface";
import MeetingParticipant from "../models/meetingParticipant.model";
import MeetingSession from "../models/meetingSession.model";

export const MINUTE_MS = 60 * 1000;

const MIN_ROOM_MINUTES = 5;

export const mintToken = (): string => crypto.randomBytes(32).toString("base64url");

export const callName = (participant: MeetingParticipant | null): string =>
    participant?.display_name ?? "Guest";

export const scheduleFrom = (startsAt: Date, endsAt: Date | null): IMeetingWindow => ({
    startsAt,
    endsAt:
        endsAt ??
        new Date(startsAt.getTime() + Env.meeting.MEETING_DEFAULT_DURATION_MINUTES * MINUTE_MS),
});

export const scheduleOf = (meeting: MeetingSession): IMeetingWindow =>
    scheduleFrom(meeting.start_time, meeting.end_time);

export const sameSchedule = (a: IMeetingWindow, b: IMeetingWindow): boolean =>
    a.startsAt.getTime() === b.startsAt.getTime() && a.endsAt.getTime() === b.endsAt.getTime();

export const opensAt = (schedule: IMeetingWindow): Date =>
    new Date(schedule.startsAt.getTime() - Env.meeting.MEETING_OPENS_MINUTES_BEFORE * MINUTE_MS);

export const occupancyOf = (schedule: IMeetingWindow): IMeetingWindow => ({
    startsAt: new Date(schedule.startsAt.getTime() - Env.meeting.MEETING_BUFFER_MINUTES * MINUTE_MS),
    endsAt: new Date(schedule.endsAt.getTime() + Env.meeting.MEETING_BUFFER_MINUTES * MINUTE_MS),
});

export const mergeWindows = (windows: IMeetingWindow[]): IMeetingWindow[] =>
    [...windows]
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .reduce<IMeetingWindow[]>((merged, window) => {
            const last = merged[merged.length - 1];
            if (last && window.startsAt.getTime() <= last.endsAt.getTime()) {
                last.endsAt = new Date(Math.max(last.endsAt.getTime(), window.endsAt.getTime()));
            } else {
                merged.push({ ...window });
            }
            return merged;
        }, []);

export const saturatedWindows = (occupancies: IMeetingWindow[], threshold: number): IMeetingWindow[] => {
    const events = occupancies
        .flatMap((window) => [
            { at: window.startsAt.getTime(), delta: 1 },
            { at: window.endsAt.getTime(), delta: -1 },
        ])
        .sort((a, b) => a.at - b.at || a.delta - b.delta);

    const windows: IMeetingWindow[] = [];
    let count = 0;
    let openedAt = 0;

    for (const event of events) {
        const before = count;
        count += event.delta;

        if (before < threshold && count >= threshold) openedAt = event.at;
        if (before >= threshold && count < threshold && event.at > openedAt) {
            windows.push({ startsAt: new Date(openedAt), endsAt: new Date(event.at) });
        }
    }

    return mergeWindows(windows);
};

export const roomWindow =(schedule: IMeetingWindow): { validFrom: Date; validUntil: Date } => {
    const now = Date.now();
    return {
        validFrom: new Date(Math.max(opensAt(schedule).getTime(), now)),
        validUntil: new Date(Math.max(schedule.endsAt.getTime(), now + MIN_ROOM_MINUTES * MINUTE_MS)),
    };
};

export const hasEnded = (meeting: MeetingSession): boolean =>
    meeting.meeting_status === "ENDED" || meeting.meeting_status === "CANCELLED";

export const isFinal = (meeting: MeetingSession): boolean =>
    hasEnded(meeting) || meeting.meeting_status === "REVOKED";

export const liveStatus = (meeting: MeetingSession): MeetingStatus => {
    if (isFinal(meeting)) return meeting.meeting_status;

    const schedule = scheduleOf(meeting);
    const now = Date.now();

    if (schedule.endsAt.getTime() <= now) return "EXPIRED";
    if (opensAt(schedule).getTime() > now) return "SCHEDULED";
    return "ACTIVE";
};

export const isClosed = (meeting: MeetingSession): boolean => {
    const status = liveStatus(meeting);
    return status !== "SCHEDULED" && status !== "ACTIVE";
};

import { Env } from "../../config/env.config";
import { sendVirtualAvatarCancellation } from "../../email/emailSender/virtualAvatarCancellationEmail";
import { sendVirtualAvatarInvite } from "../../email/emailSender/virtualAvatarInviteEmail";
import { sendVirtualAvatarReschedule } from "../../email/emailSender/virtualAvatarRescheduleEmail";
import { isClosed, liveStatus, scheduleOf } from "../../helpers/meeting.helper";
import { trace, traceFailure } from "../../helpers/trace.helper";
import { IMeetingWindow } from "../../interfaces/IMeeting.interface";
import MeetingParticipant from "../../models/meetingParticipant.model";
import MeetingSession from "../../models/meetingSession.model";
import * as meetingRepo from "../../repositories/meeting/meetingSession.repository";
import { recordEvent, recordFailure, scopeOfMeeting } from "./meetingHistory.service";

type Send = (participant: MeetingParticipant, companyName: string) => Promise<void>;

const NOTICE_EVENT_PREFIX: Record<string, string> = {
    invites: "INVITE",
    reschedule: "RESCHEDULE_NOTICE",
    cancellation: "CANCELLATION_NOTICE",
};

const NOTICE_LABEL: Record<string, string> = {
    invites: "Invitation email",
    reschedule: "Reschedule email",
    cancellation: "Cancellation email",
};

const mailEntry = (
    notice: string,
    participant: MeetingParticipant,
    suffix: "SENT" | "FAILED" | "SKIPPED",
    message: string,
    details: Record<string, unknown> = {},
) => ({
    track: "EMAIL_NOTIFICATION" as const,
    provider: "SMTP" as const,
    eventType: `${NOTICE_EVENT_PREFIX[notice]}_${suffix}`,
    message,
    recipientEmail: participant.email,
    details: {
        role: participant.role,
        participantId: Number(participant.meeting_participant_id),
        ...details,
    },
});

const greetingName = (participant: MeetingParticipant): string =>
    participant.display_name || participant.email.split("@")[0];

const mailEach = async (
    meeting: MeetingSession,
    notice: string,
    participants: MeetingParticipant[],
    send: Send,
): Promise<void> => {
    if (participants.length === 0) return;

    if (!Env.mail.MAIL_HOST) {
        trace("meeting", meeting.uuid, `${notice}_skipped`, { reason: "MAIL_HOST is not set" });
        await recordEvent(scopeOfMeeting(meeting), {
            track: "EMAIL_NOTIFICATION",
            provider: "SMTP",
            eventType: `${NOTICE_EVENT_PREFIX[notice]}_SKIPPED`,
            outcome: "SKIPPED",
            message: `${NOTICE_LABEL[notice]} was not sent because mail is not configured`,
            details: { reason: "MAIL_HOST is not set", recipients: participants.length },
        });
        return;
    }

    const company = await meetingRepo.findCompany(meeting.company_id);
    const companyName = company?.company_name ?? Env.mail.MAIL_FROM_NAME;
    const result = { sent: 0, failed: 0 };

    const scope = scopeOfMeeting(meeting);

    for (const participant of participants) {
        const retrying = participant.email_status === "FAILED";

        try {
            await send(participant, companyName);
            result.sent += 1;
            await recordEvent(scope, {
                ...mailEntry(notice, participant, "SENT", `${NOTICE_LABEL[notice]} delivered`, { retrying }),
                outcome: retrying ? "RETRIED" : "OK",
            });
        } catch (error) {
            traceFailure("meeting", meeting.uuid, `${notice}-email`, error);
            result.failed += 1;
            await recordFailure(
                scope,
                mailEntry(notice, participant, "FAILED", `${NOTICE_LABEL[notice]} could not be delivered`, { retrying }),
                error,
            );
        }
    }

    trace("meeting", meeting.uuid, `${notice}_sent`, result);
};

const invited = async (meeting: MeetingSession): Promise<MeetingParticipant[]> =>
    (await meetingRepo.findParticipants(meeting.meeting_session_id)).filter(
        (participant) => participant.email_status === "SENT",
    );

export const sendMeetingInvites = async (meeting: MeetingSession): Promise<void> => {
    const participants = await meetingRepo.findParticipants(meeting.meeting_session_id);
    const unsent = participants.filter((participant) => participant.email_status !== "SENT");

    if (unsent.length > 0 && isClosed(meeting)) {
        trace("meeting", meeting.uuid, "invites_skipped", { reason: liveStatus(meeting) });
        await recordEvent(scopeOfMeeting(meeting), {
            track: "EMAIL_NOTIFICATION",
            provider: "SMTP",
            eventType: "INVITE_SKIPPED",
            outcome: "SKIPPED",
            message: "Invitation emails were not sent because the meeting is already closed",
            details: { reason: liveStatus(meeting), unsent: unsent.length },
        });
        return;
    }

    const { startsAt, endsAt } = scheduleOf(meeting);

    await mailEach(meeting, "invites", unsent, async (participant, companyName) => {
        try {
            await sendVirtualAvatarInvite({
                to: participant.email,
                displayName: greetingName(participant),
                role: participant.role,
                inviteLink: participant.session_link,
                publicLink: participant.role === "ORGANIZER" ? meeting.public_link : null,
                sessionReference: meeting.uuid,
                topic: meeting.topic,
                scheduledFor: startsAt,
                expiresAt: endsAt,
                recordingRequested: meeting.recording_requested,
                companyName,
            });
        } catch (error) {
            await meetingRepo.markEmailFailed(
                participant,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }

        await meetingRepo.markEmailSent(participant, {
            role: participant.role,
            publicLinkShared: participant.role === "ORGANIZER" && Boolean(meeting.public_link),
            topic: meeting.topic,
            scheduledFor: startsAt.toISOString(),
            expiresAt: endsAt.toISOString(),
            recordingRequested: meeting.recording_requested,
        });
    });
};

export const sendMeetingReschedules = async (
    meeting: MeetingSession,
    previous: IMeetingWindow,
): Promise<void> =>
    mailEach(meeting, "reschedule", await invited(meeting), (participant, companyName) =>
        sendVirtualAvatarReschedule({
            to: participant.email,
            displayName: greetingName(participant),
            inviteLink: participant.session_link,
            sessionReference: meeting.uuid,
            topic: meeting.topic,
            previous,
            current: scheduleOf(meeting),
            companyName,
        }),
    );

export const sendMeetingCancellations = async (meeting: MeetingSession): Promise<void> =>
    mailEach(meeting, "cancellation", await invited(meeting), (participant, companyName) =>
        sendVirtualAvatarCancellation({
            to: participant.email,
            displayName: greetingName(participant),
            sessionReference: meeting.uuid,
            topic: meeting.topic,
            scheduled: scheduleOf(meeting),
            companyName,
        }),
    );

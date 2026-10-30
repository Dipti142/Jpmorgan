import { Env } from "../config/env.config";
import { trace, traceFailure } from "../helpers/trace.helper";
import { getJson } from "./teamsGraph.service";
import { IGraphCalendarEvent, IGraphMessage } from "../interfaces/ITeamsGraph.interface";
import { IIcsEvent, isCancelledEvent, parseIcs } from "../helpers/ics.helper";
import { IMeetingRecipient, IMeetingSessionView } from "../interfaces/IMeeting.interface";
import { sleep } from "../helpers/utility.helper";
import { scheduleFrom } from "../helpers/meeting.helper";
import { resolveRole } from "./meeting/meetingRole.service";
import * as meetingRepo from "../repositories/meeting/meetingSession.repository";
import * as meetingSession from "./meeting/meetingSession.service";
import { bookMeeting } from "./meeting/vaSchedule.service";
import { freeInviteEvent, FIND_POLL_MS, FIND_TIMEOUT_MS } from "./teamsCalendar.service";
import { matchJobForInvite as matchJob } from "./workable/job.service";

const SELECT = [
    "id",
    "subject",
    "from",
    "toRecipients",
    "ccRecipients",
    "receivedDateTime",
    "body",
    "bodyPreview",
    "hasAttachments",
    "webLink",
].join(",");

/** PidLidCleanGlobalObjectId. Its hex is the iCalUId, and it rides on the message itself. */
const GOID_PROPERTY = "Binary {6ed8da90-450b-101b-98da-00aa003f1305} Id 0x23";

const logMail = (reference: string, event: string, detail: Record<string, unknown> = {}): void =>
    trace("mail", reference, event, detail);

// meetingMessageType only resolves through the derived-type cast; plain $select is rejected.
const fetchMessage = async (messageId: string): Promise<IGraphMessage> =>
    getJson<IGraphMessage>(
        `/users/${Env.teams.AGENT_MAILBOX}/messages/${messageId}` +
            `?$select=${SELECT},microsoft.graph.eventMessage/meetingMessageType` +
            `&$expand=microsoft.graph.eventMessage/event,singleValueExtendedProperties` +
            `($filter=${encodeURIComponent(`id eq '${GOID_PROPERTY}'`)})`,
        { Prefer: 'outlook.body-content-type="text", outlook.timezone="UTC"' },
    );

const SENDER_NAME = Env.workable.WORKABLE_INVITE_SENDER_NAME.trim().toLowerCase();

const senderDomain = (domain: string): RegExp => new RegExp(`@${domain.replace(/\./g, "\\.")}$`, "i");

const WORKABLE_SENDER = senderDomain(Env.workable.WORKABLE_INVITE_SENDER_DOMAIN);
const STAFF_SENDER = senderDomain(Env.workable.STAFF_INVITE_SENDER_DOMAIN);

const isInviteSender = (sender?: { name?: string; address?: string }): boolean => {
    const address = sender?.address ?? "";

    return (
        STAFF_SENDER.test(address) ||
        (WORKABLE_SENDER.test(address) && sender?.name?.trim().toLowerCase() === SENDER_NAME)
    );
};

const isCalendarInvite = (name?: string, contentType?: string): boolean =>
    /calendar|ics/i.test(contentType ?? "") || /\.ics$/i.test(name ?? "");

/** An invite carrying its own join link is run by whoever sent it, so the agent has no part in it. */
const HOSTED_ELSEWHERE = /teams\.microsoft\.com|teams\.live\.com|zoom\.us|meet\.google\.com/i;

const fetchAttachments = async (messageId: string) =>
    getJson<{ value: unknown[] }>(
        `/users/${Env.teams.AGENT_MAILBOX}/messages/${messageId}/attachments`,
    );

const findInvite = async (messageId: string) => {
    const { value } = await fetchAttachments(messageId);

    for (const attachment of value) {
        const { name, contentType, contentBytes } = attachment as Record<string, string>;
        if (isCalendarInvite(name, contentType) && contentBytes) return parseIcs(contentBytes);
    }

    return null;
};

const graphTime = (slot?: { dateTime?: string }): Date | null =>
    slot?.dateTime ? new Date(`${slot.dateTime.slice(0, 19)}Z`) : null;

const icsUidOf = (message: IGraphMessage): string | null => {
    const property = message.singleValueExtendedProperties?.find(
        (entry) => entry.id?.toLowerCase() === GOID_PROPERTY.toLowerCase(),
    );

    return property?.value
        ? Buffer.from(property.value, "base64").toString("hex").toUpperCase()
        : null;
};

// A cancellation can arrive after the calendar copy was cleared, leaving only the message itself.
const inviteFromEvent = (message: IGraphMessage, event: IGraphCalendarEvent | null): IIcsEvent => ({
    method: null,
    status:
        event?.isCancelled || message.meetingMessageType === "meetingCancelled" ? "CANCELLED" : null,
    uid: event?.iCalUId ?? icsUidOf(message),
    summary: event?.subject ?? message.subject ?? null,
    location: event?.location?.displayName ?? null,
    description: message.bodyPreview ?? null,
    startsAt: graphTime(event?.start),
    endsAt: graphTime(event?.end),
    url: event?.webLink ?? null,
    organiser: event?.organizer?.emailAddress
        ? {
              name: event.organizer.emailAddress.name ?? null,
              email: event.organizer.emailAddress.address ?? null,
          }
        : null,
    attendees: (event?.attendees ?? [])
        .filter((attendee) => attendee.type !== "resource")
        .map((attendee) => ({
            name: attendee.emailAddress?.name ?? null,
            email: attendee.emailAddress?.address ?? null,
            status: attendee.status?.response ?? null,
        })),
});

const recipientsOf = (message: IGraphMessage, invite: IIcsEvent): IMeetingRecipient[] => {
    const inviteNames = new Map<string, string | null>();
    for (const person of invite.attendees) {
        const email = person?.email?.trim().toLowerCase();
        if (email && !inviteNames.has(email)) inviteNames.set(email, person?.name?.trim() || null);
    }

    const named = new Map<string, string | null>(message.meetingMessageType ? inviteNames : []);

    for (const entry of [...(message.toRecipients ?? []), ...(message.ccRecipients ?? [])]) {
        const email = entry.emailAddress?.address?.trim().toLowerCase();
        if (!email) continue;
        if (!named.get(email)) {
            named.set(email, inviteNames.get(email) || entry.emailAddress?.name?.trim() || null);
        }
    }

    // The organiser also sits in the attendee list; they are only invited when they are one of ours.
    const organiser = invite.organiser?.email?.trim().toLowerCase() ?? "";
    if (resolveRole(organiser) !== "ORGANIZER") named.delete(organiser);

    return [...named].map(([email, name]) => ({ email, displayName: name || email.split("@")[0] }));
};


const freeCalendar = async (invite: IIcsEvent, reference: string): Promise<void> => {
    if (!invite.uid) return;
    await freeInviteEvent(invite.uid, reference).catch((error) =>
        traceFailure("calendar", reference, "free-invite-event", error),
    );
};

const handleInvite = async (message: IGraphMessage, invite: IIcsEvent): Promise<void> => {
    if (isCancelledEvent(invite)) {
        const cancelled = await meetingSession.cancelFromInvite({
            icsUid: invite.uid,
            sourceMessageId: message.id,
        });

        if (cancelled) {
            logMail(message.id, "meeting_cancelled", { meeting: cancelled.uuid, status: cancelled.meetingStatus });
        } else {
            logMail(message.id, "skipped", { reason: "cancellation for an unknown meeting" });
        }
        return;
    }

    if (!invite.startsAt) {
        logMail(message.id, "skipped", { reason: "invite has no start time" });
        return;
    }

    const recipients = recipientsOf(message, invite);
    const schedule = scheduleFrom(invite.startsAt, invite.endsAt);

    const job = await matchJob({
        reference: message.id,
        title: invite.summary,
        recipients,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
    });

    // Mail to the masked alias is ingested by Workable, which then cancels the interview.
    const alias = recipients.findIndex((recipient) => WORKABLE_SENDER.test(recipient.email));
    const unmasked =
        job && !WORKABLE_SENDER.test(job.candidateEmail) && resolveRole(job.candidateEmail) === "CANDIDATE"
            ? job
            : null;

    if (alias >= 0 && unmasked) {
        recipients[alias] = {
            email: unmasked.candidateEmail,
            displayName: unmasked.candidateName ?? recipients[alias].displayName,
        };
        logMail(message.id, "candidate_unmasked", { email: unmasked.candidateEmail });
    } else if (alias >= 0) {
        logMail(message.id, "candidate_unresolved", { alias: recipients[alias].email });
    }

    const invited = [
        ...new Map(
            recipients
                .filter((recipient) => !WORKABLE_SENDER.test(recipient.email))
                .map((recipient) => [recipient.email, recipient]),
        ).values(),
    ];

    const meeting = await meetingSession.createFromInvite({
        icsUid: invite.uid,
        topic: invite.summary,
        startsAt: invite.startsAt,
        endsAt: invite.endsAt,
        recipients: invited,
        sourceMessageId: message.id,
    });


    if (job) {
        await meetingRepo.setJobShortCode(meeting.meetingSessionId, job.shortcode);
        await meetingRepo.setCandidateId(meeting.meetingSessionId, {
            email: job.candidateEmail,
            candidateId: job.candidateId,
        });
    }

    await bookMeeting(meeting.meetingSessionId, job?.eventId ?? null);

    logMail(message.id, "meeting_linked", {
        meeting: meeting.uuid,
        alreadyExisted: meeting.alreadyExisted,
        job: job?.shortcode ?? "none",
        invited: meeting.participants.length,
    });
    printJoinLinks(meeting);
};

const printJoinLinks = (meeting: IMeetingSessionView): void => {
    if (Env.is_production) return;

    console.log(`  ${"GUEST".padEnd(9)} (public link) -> ${meeting.publicLink ?? "-"}`);
    for (const participant of meeting.participants) {
        console.log(
            `  ${participant.role.padEnd(9)} ${participant.email} -> ${participant.sessionLink} [email ${participant.emailStatus}]`,
        );
    }
};

const onNewMail = async (message: IGraphMessage): Promise<void> => {
    const sender = message.from?.emailAddress;

    if (!isInviteSender(sender)) {
        logMail(message.id, "skipped", { reason: "sender", from: sender?.address ?? "-" });
        return;
    }

    const meetingType = message.meetingMessageType ?? "none";
    let invite: IIcsEvent | null = null;

    if (meetingType === "meetingRequest" || meetingType === "meetingCancelled") {
        const deadline = Date.now() + FIND_TIMEOUT_MS;
        let event = message.event ?? null;

        while (!event && meetingType === "meetingRequest" && Date.now() < deadline) {
            await sleep(FIND_POLL_MS);
            event = (await fetchMessage(message.id)).event ?? null;
        }

        if (!event && meetingType !== "meetingCancelled") {
            logMail(message.id, "skipped", { reason: "no calendar copy", meetingType });
            return;
        }

        if (event?.type && event.type !== "singleInstance") {
            logMail(message.id, "skipped", { reason: "recurring invite", type: event.type });
            return;
        }

        invite = inviteFromEvent(message, event);
        logMail(message.id, "event_invite", {
            meetingType,
            uid: invite.uid,
            timeZone: event?.start?.timeZone ?? "-",
            attendees: invite.attendees.length,
        });
    } else if (meetingType !== "none") {
        logMail(message.id, "skipped", { reason: "meeting response", meetingType });
        return;
    } else if (message.hasAttachments) {
        invite = await findInvite(message.id);
    }

    if (!invite) {
        logMail(message.id, "skipped", { reason: "no calendar invite", from: sender?.address });
        return;
    }

    const hosted = HOSTED_ELSEWHERE.exec(
        [invite.location, invite.description, message.body?.content].join("\n"),
    );
    if (hosted) {
        logMail(message.id, "skipped", { reason: "meeting hosted elsewhere", host: hosted[0].toLowerCase() });
        return;
    }

    const calendarFreed = freeCalendar(invite, message.id);

    try {
        await handleInvite(message, invite);
    } finally {
        await calendarFreed;
    }
};

export const handleNotifications = async (messageIds: string[]): Promise<void> => {
    for (const messageId of messageIds) {
        try {
            await onNewMail(await fetchMessage(messageId));
        } catch (error) {
            traceFailure("mail", messageId, "fetch", error);
        }
    }
};

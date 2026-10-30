import { Env } from "../config/env.config";
import { trace } from "../helpers/trace.helper";
import { sleep } from "../helpers/utility.helper";
import { IMeetingWindow } from "../interfaces/IMeeting.interface";
import { IGraphCalendarEvent, IGraphCollection } from "../interfaces/ITeamsGraph.interface";
import { getJson, patchJson, postJson } from "./teamsGraph.service";

export const FIND_TIMEOUT_MS = 10_000;
export const FIND_POLL_MS = 2_000;

export const eventsPath = (): string => `/users/${Env.teams.AGENT_MAILBOX}/events`;

export const createBlockEvent = async (
    block: IMeetingWindow & { subject: string; body: string; transactionId: string },
): Promise<IGraphCalendarEvent> =>
    postJson<IGraphCalendarEvent>(
        eventsPath(),
        {
            subject: block.subject,
            body: { contentType: "text", content: block.body },
            showAs: "busy",
            sensitivity: "private",
            isReminderOn: false,
            categories: ["persona-saturation"],
            transactionId: block.transactionId,
            start: { dateTime: block.startsAt.toISOString().slice(0, 19), timeZone: "UTC" },
            end: { dateTime: block.endsAt.toISOString().slice(0, 19), timeZone: "UTC" },
        },
        { Prefer: 'IdType="ImmutableId"' },
    );

const findInviteEvents = async (icsUid: string): Promise<IGraphCalendarEvent[]> => {
    const filter = encodeURIComponent(`iCalUId eq '${icsUid.replace(/'/g, "''")}'`);
    const { value } = await getJson<IGraphCollection<IGraphCalendarEvent>>(
        `${eventsPath()}?$filter=${filter}&$select=id`,
    );
    return value;
};

// Deleting the agent copy declines the meeting to the organiser, which Workable reads as
// the interview being dropped. Freeing the slot leaves the invite itself untouched.
export const freeInviteEvent = async (icsUid: string, reference: string): Promise<void> => {
    const deadline = Date.now() + FIND_TIMEOUT_MS;
    let events = await findInviteEvents(icsUid);

    while (events.length === 0 && Date.now() < deadline) {
        await sleep(FIND_POLL_MS);
        events = await findInviteEvents(icsUid);
    }

    for (const event of events) {
        await patchJson(`${eventsPath()}/${event.id}`, { showAs: "free" });
    }

    trace("calendar", reference, events.length > 0 ? "invite_event_freed" : "invite_event_not_found", {
        freed: events.length,
    });
};


const PROPERTY = /^([^;:]+)((?:;[^:]*)*):(.*)$/;

const ICS_DATE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/;


const unfold = (text: string): string[] => text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);

const unescape = (value: string): string =>
    value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

const toDate = (value: string): Date | null => {
    const match = ICS_DATE.exec(value);
    if (!match) return null;

    const [, y, m, d, hh, mm, ss] = match;
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
};

export const toIcsStamp = (when: Date): string =>
    `${when.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;

const param = (params: string, key: string): string | null => {
    const match = new RegExp(`;${key}=([^;]*)`, "i").exec(params);
    return match ? match[1].replace(/^"|"$/g, "") : null;
};

const person = (params: string, value: string) => ({
    name: param(params, "CN"),
    email: value.replace(/^mailto:/i, "") || null,
    status: param(params, "PARTSTAT"),
});

export interface IIcsEvent {
    method: string | null;
    status: string | null;
    uid: string | null;
    summary: string | null;
    location: string | null;
    description: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    url: string | null;
    organiser: { name: string | null; email: string | null } | null;
    attendees: { name: string | null; email: string | null; status: string | null }[];
}

export const parseIcs = (contentBytes: string): IIcsEvent => {
    const text = Buffer.from(contentBytes, "base64").toString("utf8");

    const event: IIcsEvent = {
        method: null,
        status: null,
        uid: null,
        summary: null,
        location: null,
        description: null,
        startsAt: null,
        endsAt: null,
        url: null,
        organiser: null,
        attendees: [],
    };

    for (const line of unfold(text)) {
        const match = PROPERTY.exec(line);
        if (!match) continue;

        const [, name, params, raw] = match;
        const value = unescape(raw);

        switch (name.toUpperCase()) {
            case "METHOD":
                event.method = value.trim().toUpperCase();
                break;
            case "STATUS":
                event.status = value.trim().toUpperCase();
                break;
            case "UID":
                event.uid = value;
                break;
            case "SUMMARY":
                event.summary = value;
                break;
            case "LOCATION":
                event.location = value;
                break;
            case "DESCRIPTION":
                event.description = value;
                break;
            case "DTSTART":
                event.startsAt = toDate(value);
                break;
            case "DTEND":
                event.endsAt = toDate(value);
                break;
            case "URL":
                event.url = value;
                break;
            case "ORGANIZER":
                event.organiser = person(params, value);
                break;
            case "ATTENDEE":
                event.attendees.push(person(params, value));
                break;
        }
    }

    return event;
};

export const isCancelledEvent = (event: IIcsEvent): boolean =>
    event.method === "CANCEL" || event.status === "CANCELLED";

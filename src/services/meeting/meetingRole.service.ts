import { Env } from "../../config/env.config";
import { MeetingAcsRole, MeetingRole } from "../../interfaces/IMeeting.interface";


const organizerDomain = (): RegExp =>
    new RegExp(
        `@${Env.meeting.MEETING_ORGANIZER_EMAIL_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
    );

export const resolveRole = (email: string): MeetingRole => {
    const address = email.trim().toLowerCase();

    if (address === Env.meeting.AGENT_EMAIL_ID) return "AGENT";
    if (organizerDomain().test(address)) return "ORGANIZER";
    return "CANDIDATE";
};

export const entersLobby = (role: MeetingRole): boolean => role === "AGENT";

export const locksToOneDevice = (role: MeetingRole): boolean => role === "CANDIDATE";

export const acsRoleFor = (role: MeetingRole): MeetingAcsRole =>
    role === "ORGANIZER" ? "Presenter" : "Attendee";

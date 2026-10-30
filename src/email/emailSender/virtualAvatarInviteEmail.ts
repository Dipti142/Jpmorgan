import { getMailTransport, mailFrom, mailTemplate } from "../../config/mail.config";
import { MeetingRole } from "../../interfaces/IMeeting.interface";
import { VirtualAvatarParticipantRole } from "../../interfaces/IVirtualAvatarSession.interface";

export interface IVirtualAvatarInviteEmail {
    to: string;
    displayName: string;
    /** Meetings spell it ORGANIZER, VA sessions ORGANISER - both are accepted. */
    role: VirtualAvatarParticipantRole | MeetingRole;
    inviteLink: string;
    publicLink: string | null;
    sessionReference: string;
    topic: string | null;
    scheduledFor: Date | null;
    expiresAt: Date;
    recordingRequested: boolean;
    companyName: string;
}

const formatWhen = (value: Date): string =>
    value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) +
    " UTC";

export const sendVirtualAvatarInvite = async (input: IVirtualAvatarInviteEmail): Promise<void> => {
    const html = mailTemplate("virtualAvatarInvite.hbs", {
        displayName: input.displayName,
        inviteLink: input.inviteLink,
        publicLink: input.publicLink,
        sessionReference: input.sessionReference,
        topic: input.topic,
        scheduledFor: input.scheduledFor ? formatWhen(input.scheduledFor) : null,
        expiresAt: formatWhen(input.expiresAt),
        entersLobby: input.role === "AGENT",
        isOrganiser: input.role === "ORGANISER" || input.role === "ORGANIZER",
        recordingRequested: input.recordingRequested,
        companyName: input.companyName,
    });

    const mailResponse = await getMailTransport().sendMail({
        from: mailFrom(),
        to: input.to,
        subject: input.topic
            ? `Your link for ${input.topic} (${input.sessionReference})`
            : `Your video session link (${input.sessionReference})`,
        html,
    });

};

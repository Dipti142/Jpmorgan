import { getMailTransport, mailFrom, mailTemplate, mailWindow } from "../../config/mail.config";
import { IMeetingWindow } from "../../interfaces/IMeeting.interface";

export interface IVirtualAvatarRescheduleEmail {
    to: string;
    displayName: string;
    inviteLink: string;
    sessionReference: string;
    topic: string | null;
    previous: IMeetingWindow;
    current: IMeetingWindow;
    companyName: string;
}

export const sendVirtualAvatarReschedule = async (input: IVirtualAvatarRescheduleEmail): Promise<void> => {
    const html = mailTemplate("virtualAvatarReschedule.hbs", {
        displayName: input.displayName,
        inviteLink: input.inviteLink,
        sessionReference: input.sessionReference,
        topic: input.topic,
        previousWindow: mailWindow(input.previous.startsAt, input.previous.endsAt),
        currentWindow: mailWindow(input.current.startsAt, input.current.endsAt),
        companyName: input.companyName,
    });

    await getMailTransport().sendMail({
        from: mailFrom(),
        to: input.to,
        subject: input.topic
            ? `Rescheduled: ${input.topic} (${input.sessionReference})`
            : `Rescheduled: your video session (${input.sessionReference})`,
        html,
    });
};

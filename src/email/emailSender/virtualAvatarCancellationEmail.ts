import { getMailTransport, mailFrom, mailTemplate, mailWindow } from "../../config/mail.config";
import { IMeetingWindow } from "../../interfaces/IMeeting.interface";

export interface IVirtualAvatarCancellationEmail {
    to: string;
    displayName: string;
    sessionReference: string;
    topic: string | null;
    scheduled: IMeetingWindow;
    companyName: string;
}

export const sendVirtualAvatarCancellation = async (input: IVirtualAvatarCancellationEmail): Promise<void> => {
    const html = mailTemplate("virtualAvatarCancellation.hbs", {
        displayName: input.displayName,
        sessionReference: input.sessionReference,
        topic: input.topic,
        scheduledWindow: mailWindow(input.scheduled.startsAt, input.scheduled.endsAt),
        companyName: input.companyName,
    });

    await getMailTransport().sendMail({
        from: mailFrom(),
        to: input.to,
        subject: input.topic
            ? `Cancelled: ${input.topic} (${input.sessionReference})`
            : `Cancelled: your video session (${input.sessionReference})`,
        html,
    });
};

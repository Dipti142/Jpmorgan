import { getMailTransport, mailFrom, mailTemplate } from "../../config/mail.config";

export interface ICandidateRegistrationEmail {
    to: string;
    displayName: string;
    jobTitle: string | null;
    jobLocation: string | null;
    registrationLink: string;
    companyName: string;
}

export const sendCandidateRegistration = async (input: ICandidateRegistrationEmail): Promise<void> => {
    const html = mailTemplate("candidateRegistration.hbs", {
        displayName: input.displayName,
        jobTitle: input.jobTitle,
        jobLocation: input.jobLocation,
        registrationLink: input.registrationLink,
        companyName: input.companyName,
    });

    await getMailTransport().sendMail({
        from: mailFrom(),
        to: input.to,
        subject: `Congratulations! You passed your interview at ${input.companyName}`,
        html,
    });
};

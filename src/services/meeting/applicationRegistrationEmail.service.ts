import { Env } from "../../config/env.config";
import { sendCandidateRegistration } from "../../email/emailSender/candidateRegistrationEmail";
import { traceFailure } from "../../helpers/trace.helper";
import { IHistoryEntryInput, IHistoryScope } from "../../interfaces/IMeetingTimeline.interface";
import ApplicationDetails from "../../models/applicationDetails.model";
import * as applicationRepo from "../../repositories/meeting/applicationDetails.repository";
import * as meetingSessionRepo from "../../repositories/meeting/meetingSession.repository";
import { recordEvent, recordFailure } from "./meetingHistory.service";

const scopeOf = (application: ApplicationDetails): IHistoryScope => ({
    companyId: Number(application.company_id),
    meetingSessionId: Number(application.meeting_session_id),
    reference: application.meeting?.uuid,
});

const historyEntry = (
    application: ApplicationDetails,
    staffUserId: number,
    suffix: "SENT" | "FAILED" | "SKIPPED",
    message: string,
    details: Record<string, unknown> = {},
): IHistoryEntryInput => ({
    track: "EMAIL_NOTIFICATION",
    provider: "SMTP",
    eventType: `REGISTRATION_LINK_${suffix}`,
    message,
    actor: { type: "STAFF", id: staffUserId },
    recipientEmail: application.candidate_email_id ?? undefined,
    details,
});

const deliver = async (application: ApplicationDetails): Promise<void> => {
    const to = application.candidate_email_id;
    if (!to) throw new Error("The candidate has no email address");

    const registrationLink = Env.mail.CANDIDATE_REGISTRATION_URL;
    if (!registrationLink) throw new Error("CANDIDATE_REGISTRATION_URL is not set");

    const company = await meetingSessionRepo.findCompany(application.company_id);
    await sendCandidateRegistration({
        to,
        displayName: application.candidate_name || to.split("@")[0],
        jobTitle: application.job_role_label,
        jobLocation: application.job_location,
        registrationLink,
        companyName: company?.company_name ?? Env.mail.MAIL_FROM_NAME,
    });
};

export const sendRegistrationLink = async (application: ApplicationDetails, staffUserId: number): Promise<void> => {
    const scope = scopeOf(application);

    if (application.registration_email_status === "LINK_SENT") {
        await recordEvent(scope, {
            ...historyEntry(
                application,
                staffUserId,
                "SKIPPED",
                "Registration link was not sent again because it was already sent",
            ),
            outcome: "SKIPPED",
        });
        return;
    }

    try {
        await deliver(application);
    } catch (error) {
        traceFailure("application", application.application_uuid, "registration-email", error);
        await applicationRepo.saveRegistrationEmailStatus(application, "EMAIL_FAILED");
        await recordFailure(
            scope,
            historyEntry(application, staffUserId, "FAILED", "Registration link email could not be delivered"),
            error,
        );
        return;
    }

    await applicationRepo.saveRegistrationEmailStatus(application, "LINK_SENT");
    await recordEvent(scope, historyEntry(application, staffUserId, "SENT", "Registration link email delivered"));
};

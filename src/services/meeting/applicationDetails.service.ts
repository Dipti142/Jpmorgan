import { traceFailure } from "../../helpers/trace.helper";
import { convertUtcToUserTime } from "../../helpers/utility.helper";
import { VaScheduleStatus } from "../../interfaces/IMeeting.interface";
import { Transaction } from "sequelize";
import {
    IApplicant,
    IApplicationDecision,
    IApplicationExport,
    IApplicationExportFilter,
    IApplicationListFilter,
    IApplicationReview,
    IApplicationView,
    IRegistrationEmailRequest,
} from "../../interfaces/IApplicationDetails.interface";
import ApplicationDetails from "../../models/applicationDetails.model";
import Candidate from "../../models/candidate.model";
import MeetingParticipant from "../../models/meetingParticipant.model";
import VaScheduled from "../../models/vaScheduled.model";
import * as applicationRepo from "../../repositories/meeting/applicationDetails.repository";
import * as meetingSessionRepo from "../../repositories/meeting/meetingSession.repository";
import * as vaMeetingStatusRepo from "../../repositories/meeting/vaMeetingStatus.repository";
import * as candidateRepo from "../../repositories/workable/candidate.repository";
import { findJobDetails } from "../workable/job.service";
import { sendRegistrationLink } from "./applicationRegistrationEmail.service";

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const viewOf = (row: ApplicationDetails): IApplicationView => ({
    applicationId: row.application_details_id,
    applicationUuid: row.application_uuid,
    meetingSessionId: Number(row.meeting_session_id),
    sessionReference: row.meeting?.uuid ?? null,
    applicationStatus: row.application_status,
    vaMeetingStatusId: Number(row.va_meeting_status_id),
    applicationStatusLabel: row.application_status_label,
    overriddenApplicationStatus: row.overridden_application_status,
    aiRecommendationStatusId: row.ai_recommendation_status_id === null ? null : Number(row.ai_recommendation_status_id),
    decisionHistory: row.decision_history ?? [],
    registrationEmailRequested: row.registration_email_requested === 1,
    registrationEmailStatus: row.registration_email_status,
    effectiveStatus: row.overridden_application_status ?? row.application_status,
    candidateId: row.candidate_id,
    candidateName: row.candidate_name,
    candidateEmailMasked: row.candidate_email_id ?? "",
    // candidateEmailMasked: maskEmail(row.candidate_email_id),
    candidatePhoneNumber: row.candidate_phone_number,
    jobShortCode: row.job_short_code,
    jobRoleLabel: row.job_role_label,
    jobLocation: row.job_location,
    interviewer: row.interviewer,
    applicationReceivedTs: toIso(row.application_received_ts),
    interviewScheduledTs: row.interview_scheduled_ts.toISOString(),
    reviewerNotes: row.reviewer_notes,
    escalatedForStaff: row.escalated_for_staff,
    recordingId: row.application_recording_id,
    aiRecommendation: row.ai_recommendation,
    updatedUserId: row.updated_user_id,
    guestJoinLink: row.meeting?.public_link ?? null,
    createdTs: row.created_ts.toISOString(),
    updatedTs: toIso(row.updated_ts),
});

const FORMULA_STARTS = ["=", "+", "-", "@"];

const asPlainText = (value: string | null): string => {
    if (!value) return "";
    return FORMULA_STARTS.includes(value[0]) ? `'${value}` : value;
};

const SHEET_DATE_FORMAT = "MM/DD/YYYY hh:mm A";

const sheetDate = (iso: string | null, timeZone: string | undefined): string =>
    iso ? (convertUtcToUserTime(new Date(iso), timeZone, SHEET_DATE_FORMAT) as string) : "";

const requireApplication = async (companyId: number, applicationUuid: string): Promise<ApplicationDetails> => {
    const application = await applicationRepo.findByUuid(companyId, applicationUuid);
    if (!application) throw new Error(`No application ${applicationUuid} for company ${companyId}`);
    return application;
};

export const listApplications = async (filter: IApplicationListFilter): Promise<{ applications: IApplicationView[]; total: number }> => {
    const { rows, total } = await applicationRepo.listApplications(filter);
    return { applications: rows.map(viewOf), total };
};

const EXPORT_COLUMNS: { heading: string; valueOf: (row: IApplicationView, timeZone: string | undefined) => string }[] = [
    { heading: "Interview Status", valueOf: (row) => row.overriddenApplicationStatus ?? "" },
    { heading: "Meeting Status", valueOf: (row) => row.applicationStatusLabel },
    { heading: "Candidate Name", valueOf: (row) => asPlainText(row.candidateName) },
    { heading: "Job Role", valueOf: (row) => asPlainText(row.jobRoleLabel) },
    { heading: "Job Location", valueOf: (row) => asPlainText(row.jobLocation) },
    { heading: "Interviewer", valueOf: (row) => asPlainText(row.interviewer) },
    { heading: "Application Received On", valueOf: (row, timeZone) => sheetDate(row.applicationReceivedTs, timeZone) },
    { heading: "Interview Schedule Date", valueOf: (row, timeZone) => sheetDate(row.interviewScheduledTs, timeZone) },
    { heading: "Created At", valueOf: (row, timeZone) => sheetDate(row.createdTs, timeZone) },
    { heading: "Email ID", valueOf: (row) => row.candidateEmailMasked },
    { heading: "Phone No", valueOf: (row) => row.candidatePhoneNumber ?? "" },
    { heading: "Reviewer Notes", valueOf: (row) => asPlainText(row.reviewerNotes) },
];

export const buildApplicationExport = async (filter: IApplicationExportFilter): Promise<IApplicationExport> => {
    const total = await applicationRepo.countApplications(filter);
    if (total > applicationRepo.EXPORT_MAX_ROWS) {
        throw new Error(
            `Conflict: ${total} applications match, and an export holds at most ${applicationRepo.EXPORT_MAX_ROWS}. Narrow the filters.`,
        );
    }
    if (total === 0) throw new Error("No applications found for these filters");
    const company = await meetingSessionRepo.findCompany(filter.companyId);
    const timeZone = company?.timezone ?? undefined;
    const applications = (await applicationRepo.listApplicationsForExport(filter)).map(viewOf);
    const rows = applications.map((application) =>
        Object.fromEntries(
            EXPORT_COLUMNS.map((column, index) => [`column${index}`, column.valueOf(application, timeZone)]),
        ),
    );
    return { rows, headings: EXPORT_COLUMNS.map((column) => column.heading) };
};

export const getApplication = async (companyId: number, applicationUuid: string): Promise<IApplicationView> =>
    viewOf(await requireApplication(companyId, applicationUuid));

export const reviewApplication = async (companyId: number, applicationUuid: string, review: IApplicationReview,): Promise<IApplicationView> => {
    const application = await requireApplication(companyId, applicationUuid);
    if (review.overriddenApplicationStatus) {
        const known = (await vaMeetingStatusRepo.listActive()).map((status) => status.status_code);
        if (!known.includes(review.overriddenApplicationStatus)) {
            throw new Error(`Conflict: ${review.overriddenApplicationStatus} is not an application status`);
        }
    }
    await applicationRepo.saveReview(application, {
        ...(review.reviewerNotes === undefined ? {} : { reviewer_notes: review.reviewerNotes }),
        ...(review.overriddenApplicationStatus === undefined
            ? {}
            : { overridden_application_status: review.overriddenApplicationStatus }),
        ...(review.escalatedForStaff === undefined ? {} : { escalated_for_staff: review.escalatedForStaff }),
        ...(review.updatedUserId === undefined ? {} : { updated_user_id: review.updatedUserId }),
    });

    return viewOf(application);
};

export const recordDecision = async (companyId: number, applicationUuid: string, decision: IApplicationDecision,): Promise<IApplicationView> => {
    const application = await requireApplication(companyId, applicationUuid);
    const recommendation = await vaMeetingStatusRepo.findActiveAiRecommendationById(decision.aiRecommendationStatusId);
    if (!recommendation) {
        throw new Error(`Conflict: ${decision.aiRecommendationStatusId} is not an active decision status`);
    }
    await applicationRepo.saveDecision(
        application,
        {
            ai_recommendation_status_id: recommendation.ai_recommendation_status_id,
            overridden_application_status: recommendation.status_label,
            reviewer_notes: decision.reviewerNotes,
            updated_user_id: decision.updatedUserId,
        },
        {
            updatedBy: decision.updatedUserId,
            decisionStatusId: Number(recommendation.ai_recommendation_status_id),
            decisionStatusLabel: recommendation.status_label,
            timestamp: new Date().toISOString(),
        },
    );

    return viewOf(application);
};

export const requestRegistrationEmail = async (
    companyId: number,
    applicationUuid: string,
    request: IRegistrationEmailRequest,
): Promise<{ application: IApplicationView; attempted: boolean }> => {
    const application = await requireApplication(companyId, applicationUuid);
    const recommendation = await vaMeetingStatusRepo.findActiveAiRecommendationById(request.aiRecommendationStatusId);
    if (!recommendation) {
        throw new Error(`Conflict: ${request.aiRecommendationStatusId} is not an active decision status`);
    }

    const wanted = recommendation.status_code === "PASSED" && request.registrationEmailRequested === 1;
    if (!wanted) return { application: viewOf(application), attempted: false };

    const recorded = Number(application.ai_recommendation_status_id);
    if (recorded !== Number(recommendation.ai_recommendation_status_id)) {
        throw new Error("Conflict: the recorded decision for this application is not Passed");
    }

    await applicationRepo.markRegistrationEmailRequested(application);
    await sendRegistrationLink(application, request.updatedUserId);
    return { application: viewOf(application), attempted: true };
};

const findCandidate = async (candidateId: string | null, participantEmail: string | null): Promise<Candidate | null> => {
    if (candidateId) {
        const byId = await candidateRepo.findById(candidateId);
        if (byId) return byId;
    }
    return participantEmail ? candidateRepo.findByEmail(participantEmail) : null;
};

export const loadApplicant = async (participants: MeetingParticipant[], candidateId: string | null,): Promise<IApplicant> => {
    const invitee = participants.find((participant) => participant.role === "CANDIDATE");
    const candidate = await findCandidate(candidateId, invitee?.email ?? null);
    return { candidate, candidateId, invitee };
};

const applicationStatusOf = (booking: VaScheduled): VaScheduleStatus =>
    booking.meeting_status === "SCHEDULED" && booking.reschedule_count > 0
        ? "RESCHEDULED"
        : booking.meeting_status;

export const recordBooking = async (booking: VaScheduled, applicant: IApplicant, transaction: Transaction): Promise<void> => {
    const { candidate, invitee } = applicant;
    const applicationStatus = applicationStatusOf(booking);
    const status = await vaMeetingStatusRepo.requireByCode(applicationStatus, transaction);

    await applicationRepo.upsertFromBooking(
        {
            company_id: booking.company_id,
            meeting_session_id: booking.meeting_session_id,
            application_status: applicationStatus,
            va_meeting_status_id: status.va_meeting_status_id,
            application_status_label: status.client_status_label,
            // FK into tl_candidates - only a resolved row's id is safe to store.
            candidate_id: candidate?.candidate_id ?? null,
            candidate_name: candidate?.name ?? invitee?.display_name ?? null,
            candidate_email_id: candidate?.email ?? invitee?.email ?? null,
            candidate_phone_number: candidate?.phone ?? null,
            job_short_code: booking.job_short_code ?? candidate?.job_shortcode ?? null,
            job_role_label: candidate?.job_title ?? null,
            job_location: null,
            application_received_ts: candidate?.created_at ?? candidate?.created_ts ?? null,
            interview_scheduled_ts: booking.start_time,
        },
        transaction,
    );
};

export const fillJobDetails = async (meetingSessionId: number): Promise<void> => {
    try {
        const application = await applicationRepo.findByMeetingSession(meetingSessionId);
        if (!application?.job_short_code) return;
        if (application.job_role_label && application.job_location) return;

        const job = await findJobDetails(application.job_short_code);
        if (!job) return;

        await applicationRepo.saveJobDetails(application, {
            job_role_label: job.title,
            job_location: job.location ?? application.job_location,
        });
    } catch (error) {
        traceFailure("application", String(meetingSessionId), "job-details", error);
    }
};

export const markEscalated = async (meetingSessionId: number): Promise<void> => {
    try {
        await applicationRepo.setEscalated(meetingSessionId);
    } catch (error) {
        traceFailure("application", String(meetingSessionId), "mark-escalated", error);
    }
};

export const linkRecording = async (meetingSessionId: number, recordingId: number): Promise<void> => {
    try {
        await applicationRepo.setRecording(meetingSessionId, recordingId);
    } catch (error) {
        traceFailure("application", String(meetingSessionId), "link-recording", error);
    }
};

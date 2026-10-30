import { Op, Transaction, WhereOptions } from "sequelize";
import {
    IApplicationDecisionEntry,
    IApplicationExportFilter,
    IApplicationListFilter,
    IApplicationSnapshot,
    RegistrationEmailStatus,
} from "../../interfaces/IApplicationDetails.interface";
import { VaScheduleStatus } from "../../interfaces/IMeeting.interface";
import { buildExactFilters, dateRange } from "../../helpers/utility.helper";
import ApplicationDetails from "../../models/applicationDetails.model";
import connection from "../../models/index";
import MeetingSession from "../../models/meetingSession.model";
import * as vaMeetingStatusRepo from "./vaMeetingStatus.repository";

const withMeeting = [{ model: MeetingSession, as: "meeting", attributes: ["uuid", "public_link"] }];

export const EXPORT_MAX_ROWS = 50000;

const whereOf = (filter: IApplicationExportFilter): WhereOptions<ApplicationDetails> => {
    const exactFilters = buildExactFilters({
        company_id: filter.companyId,
        job_short_code: filter.jobShortCode,
        ai_recommendation_status_id: filter.aiRecommendationStatusId,
        va_meeting_status_id: filter.vaMeetingStatusId,
        interviewer: filter.interviewer,
        escalated_for_staff: filter.escalatedForStaff,
    });
    const withInterviewRange = dateRange(filter.interviewScheduledTs, "interview_scheduled_ts", exactFilters);
    return dateRange(filter.createdTs, "created_ts", withInterviewRange);
};

export const listApplications = async (filter: IApplicationListFilter,): Promise<{ rows: ApplicationDetails[]; total: number }> => {
    const { rows, count } = await ApplicationDetails.findAndCountAll({
        where: whereOf(filter),
        include: withMeeting,
        order: [["application_details_id", "DESC"]],
        limit: filter.limit,
        offset: filter.offset,
    });

    return { rows, total: count };
};

export const countApplications = async (filter: IApplicationExportFilter): Promise<number> =>
    ApplicationDetails.count({ where: whereOf(filter) });

export const listApplicationsForExport = async (filter: IApplicationExportFilter): Promise<ApplicationDetails[]> =>
    ApplicationDetails.findAll({
        where: whereOf(filter),
        include: withMeeting,
        order: [["application_details_id", "DESC"]],
        limit: EXPORT_MAX_ROWS,
    });

export const findByUuid = async (
    companyId: number,
    applicationUuid: string,
): Promise<ApplicationDetails | null> =>
    ApplicationDetails.findOne({
        where: { company_id: companyId, application_uuid: applicationUuid },
        include: withMeeting,
    });

export const findByMeetingSession = async (
    meetingSessionId: number,
    transaction?: Transaction,
): Promise<ApplicationDetails | null> =>
    ApplicationDetails.findOne({ where: { meeting_session_id: meetingSessionId }, transaction });

export const upsertFromBooking = async (
    snapshot: IApplicationSnapshot,
    transaction: Transaction,
): Promise<ApplicationDetails> => {
    const existing = await findByMeetingSession(snapshot.meeting_session_id, transaction);
    if (!existing) return ApplicationDetails.create({ ...snapshot }, { transaction });

    const jobChanged = existing.job_short_code !== snapshot.job_short_code;
    const { job_role_label, job_location, ...booked } = snapshot;
    return existing.update(jobChanged ? snapshot : booked, { transaction });
};

export const saveJobDetails = async (
    application: ApplicationDetails,
    details: { job_role_label: string | null; job_location: string | null },
): Promise<ApplicationDetails> => application.update(details);

export const updateStatusForMeetings = async (
    meetingSessionIds: number[],
    status: VaScheduleStatus,
    transaction: Transaction,
): Promise<void> => {
    if (!meetingSessionIds.length) return;

    const vaStatus = await vaMeetingStatusRepo.requireByCode(status, transaction);

    await ApplicationDetails.update(
        {
            application_status: status,
            va_meeting_status_id: vaStatus.va_meeting_status_id,
            application_status_label: vaStatus.client_status_label,
        },
        { where: { meeting_session_id: { [Op.in]: meetingSessionIds } }, transaction },
    );
};

export const setRecording = async (meetingSessionId: number, recordingId: number): Promise<void> => {
    await ApplicationDetails.update(
        { application_recording_id: recordingId },
        { where: { meeting_session_id: meetingSessionId } },
    );
};

export const setEscalated = async (meetingSessionId: number): Promise<void> => {
    await ApplicationDetails.update(
        { escalated_for_staff: true },
        { where: { meeting_session_id: meetingSessionId } },
    );
};

export const saveDecision = (
    application: ApplicationDetails,
    changes: Partial<
        Pick<
            ApplicationDetails,
            | "reviewer_notes"
            | "overridden_application_status"
            | "ai_recommendation_status_id"
            | "updated_user_id"
        >
    >,
    entry: IApplicationDecisionEntry,
): Promise<ApplicationDetails> =>
    connection.transaction(async (transaction) => {
        const locked = await ApplicationDetails.findByPk(application.application_details_id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        const earlier = locked?.decision_history ?? [];
        return application.update({ ...changes, decision_history: [...earlier, entry] }, { transaction });
    });

export const markRegistrationEmailRequested = async (application: ApplicationDetails): Promise<ApplicationDetails> =>
    application.update({ registration_email_requested: 1 });

export const saveRegistrationEmailStatus = async (
    application: ApplicationDetails,
    status: RegistrationEmailStatus,
): Promise<ApplicationDetails> => application.update({ registration_email_status: status });

export const saveReview = async (
    application: ApplicationDetails,
    changes: Partial<
        Pick<
            ApplicationDetails,
            | "reviewer_notes"
            | "overridden_application_status"
            | "ai_recommendation_status_id"
            | "escalated_for_staff"
            | "updated_user_id"
        >
    >,
): Promise<ApplicationDetails> => application.update(changes);

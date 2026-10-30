import type Candidate from "../models/candidate.model";
import type MeetingParticipant from "../models/meetingParticipant.model";
import { VaScheduleStatus } from "./IMeeting.interface";

export interface IApplicant {
    candidate: Candidate | null;
    candidateId: string | null;
    invitee: MeetingParticipant | undefined;
}

export interface IApplicationSnapshot {
    company_id: number;
    meeting_session_id: number;
    application_status: VaScheduleStatus;
    va_meeting_status_id: number;
    application_status_label: string;
    candidate_id: string | null;
    candidate_name: string | null;
    candidate_email_id: string | null;
    candidate_phone_number: string | null;
    job_short_code: string | null;
    job_role_label: string | null;
    job_location: string | null;
    application_received_ts: Date | null;
    interview_scheduled_ts: Date;
}

export interface IApplicationListFilter {
    companyId: number;
    jobShortCode?: string;
    aiRecommendationStatusId?: number;
    vaMeetingStatusId?: number;
    interviewer?: string;
    interviewScheduledTs?: string;
    createdTs?: string;
    escalatedForStaff?: boolean;
    limit: number;
    offset: number;
}

export type IApplicationExportFilter = Omit<IApplicationListFilter, "limit" | "offset">;

export type ApplicationExportFormat = "xlsx" | "csv";

export interface IApplicationExport {
    rows: Record<string, string>[];
    headings: string[];
}

export interface IApplicationReview {
    reviewerNotes?: string | null;
    overriddenApplicationStatus?: VaScheduleStatus | null;
    escalatedForStaff?: boolean;
    updatedUserId?: number;
}

export type RegistrationEmailStatus = "LINK_SENT" | "EMAIL_FAILED";

export interface IApplicationDecisionEntry {
    updatedBy: number;
    decisionStatusId: number;
    decisionStatusLabel: string;
    timestamp: string;
}

export interface IApplicationDecision {
    aiRecommendationStatusId: number;
    reviewerNotes: string | null;
    updatedUserId: number;
}

export interface IRegistrationEmailRequest {
    aiRecommendationStatusId: number;
    registrationEmailRequested: 0 | 1;
    updatedUserId: number;
}

export interface IApplicationView {
    applicationId: number;
    applicationUuid: string;
    meetingSessionId: number;
    sessionReference: string | null;
    applicationStatus: VaScheduleStatus;
    vaMeetingStatusId: number;
    applicationStatusLabel: string;
    overriddenApplicationStatus: string | null;
    aiRecommendationStatusId: number | null;
    decisionHistory: IApplicationDecisionEntry[];
    registrationEmailRequested: boolean;
    registrationEmailStatus: RegistrationEmailStatus | null;
    effectiveStatus: string;
    candidateId: string | null;
    candidateName: string | null;
    candidateEmailMasked: string;
    candidatePhoneNumber: string | null;
    jobShortCode: string | null;
    jobRoleLabel: string | null;
    jobLocation: string | null;
    interviewer: string;
    applicationReceivedTs: string | null;
    interviewScheduledTs: string;
    reviewerNotes: string | null;
    escalatedForStaff: boolean;
    recordingId: number | null;
    aiRecommendation: string | null;
    updatedUserId: number | null;
    createdTs: string;
    updatedTs: string | null;
    guestJoinLink: string | null;
}

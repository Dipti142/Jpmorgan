import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { IApplicationDecisionEntry, RegistrationEmailStatus } from "../interfaces/IApplicationDetails.interface";
import { AiRecommendationStatus, VaScheduleStatus } from "../interfaces/IMeeting.interface";
import MeetingSession from "./meetingSession.model";

@Table({
    tableName: "tl_application_details",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    paranoid: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
    deletedAt: "deleted_ts",
})
export class ApplicationDetails extends Model {
    @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
    public application_details_id!: number;

    @Column({ type: DataType.BIGINT, allowNull: false })
    public company_id!: number;

    @Column({ type: DataType.UUID, allowNull: false, defaultValue: DataType.UUIDV4 })
    public application_uuid!: string;

    @Column({ type: DataType.STRING(20), allowNull: false })
    public application_status!: VaScheduleStatus;

    @Column({ type: DataType.BIGINT, allowNull: false })
    public va_meeting_status_id!: number;

    @Column({ type: DataType.STRING(100), allowNull: false })
    public application_status_label!: string;

    @Column({ type: DataType.STRING(100), allowNull: true })
    public candidate_id!: string | null;

    @Column({ type: DataType.STRING(200), allowNull: true })
    public candidate_name!: string | null;

    @Column({ type: DataType.STRING(50), allowNull: true })
    public job_short_code!: string | null;

    @Column({ type: DataType.STRING(200), allowNull: true })
    public job_role_label!: string | null;

    @Column({ type: DataType.STRING(255), allowNull: true })
    public job_location!: string | null;

    @Column({ type: DataType.STRING(50), allowNull: false, defaultValue: "AI" })
    public interviewer!: string;

    @Column({ type: DataType.DATE, allowNull: true })
    public application_received_ts!: Date | null;

    @Column({ type: DataType.DATE, allowNull: false })
    public interview_scheduled_ts!: Date;

    @Column({ type: DataType.STRING(255), allowNull: true })
    public candidate_email_id!: string | null;

    @Column({ type: DataType.STRING(50), allowNull: true })
    public candidate_phone_number!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    public reviewer_notes!: string | null;

    @Column({ type: DataType.STRING(20), allowNull: true })
    public overridden_application_status!: string | null;

    @Column({ type: DataType.BIGINT, allowNull: true })
    public ai_recommendation_status_id!: number | null;

    @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
    public decision_history!: IApplicationDecisionEntry[];

    @Column({ type: DataType.SMALLINT, allowNull: false, defaultValue: 0 })
    public registration_email_requested!: number;

    @Column({ type: DataType.STRING(20), allowNull: true })
    public registration_email_status!: RegistrationEmailStatus | null;

    @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
    public escalated_for_staff!: boolean;

    @Column({ type: DataType.BIGINT, allowNull: true })
    public application_recording_id!: number | null;

    @Column({ type: DataType.BIGINT, allowNull: true })
    public updated_user_id!: number | null;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
    public status!: number;

    @Column({ type: DataType.STRING(20), allowNull: true })
    public ai_recommendation!: AiRecommendationStatus | null;

    @ForeignKey(() => MeetingSession)
    @Column({ type: DataType.BIGINT, allowNull: false })
    public meeting_session_id!: number;

    @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
    public created_ts!: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    public updated_ts!: Date | null;

    @Column({ type: DataType.DATE, allowNull: true })
    public deleted_ts!: Date | null;

    @BelongsTo(() => MeetingSession, { foreignKey: "meeting_session_id", as: "meeting" })
    public meeting!: MeetingSession;
}

export default ApplicationDetails;

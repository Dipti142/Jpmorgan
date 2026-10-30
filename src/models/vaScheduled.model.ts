import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { VaScheduleStatus } from "../interfaces/IMeeting.interface";
import AnamAvatar from "./anamAvatar.model";
import CustomScriptTemplate from "./customScriptTemplate.model";
import MeetingSession from "./meetingSession.model";

@Table({
    tableName: "tl_va_scheduled",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
export class VaScheduled extends Model {
    @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
    public va_scheduled_id!: number;

    @Column({ type: DataType.BIGINT, allowNull: false })
    public company_id!: number;

    @ForeignKey(() => MeetingSession)
    @Column({ type: DataType.BIGINT, allowNull: false })
    public meeting_session_id!: number;

    @Column({ type: DataType.TEXT, allowNull: true })
    public ics_uid!: string | null;

    @Column({ type: DataType.STRING(100), allowNull: true })
    public workable_event_id!: string | null;

    @Column({ type: DataType.STRING(100), allowNull: true })
    public candidate_id!: string | null;

    @Column({ type: DataType.STRING(50), allowNull: true })
    public job_short_code!: string | null;

    @ForeignKey(() => AnamAvatar)
    @Column({ type: DataType.BIGINT, allowNull: true })
    public anam_avatar_id!: number | null;

    @Column({ type: DataType.STRING(100), allowNull: true })
    public persona_name!: string | null;

    @ForeignKey(() => CustomScriptTemplate)
    @Column({ type: DataType.BIGINT, allowNull: true })
    public custom_script_template_id!: number | null;

    @Column({ type: DataType.STRING(150), allowNull: true })
    public topic!: string | null;

    @Column({ type: DataType.DATEONLY, allowNull: false })
    public schedule_date!: string;

    @Column({ type: DataType.DATE, allowNull: false })
    public start_time!: Date;

    @Column({ type: DataType.DATE, allowNull: false })
    public end_time!: Date;

    @Column({ type: DataType.DATE, allowNull: false })
    public occupancy_start!: Date;

    @Column({ type: DataType.DATE, allowNull: false })
    public occupancy_end!: Date;

    @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: "SCHEDULED" })
    public meeting_status!: VaScheduleStatus;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
    public reschedule_count!: number;

    @Column({ type: DataType.DATE, allowNull: true })
    public started_ts!: Date | null;

    @Column({ type: DataType.DATE, allowNull: true })
    public completed_ts!: Date | null;

    @Column({ type: DataType.DATE, allowNull: true })
    public cancelled_ts!: Date | null;

    @Column({ type: DataType.STRING(50), allowNull: true })
    public cancel_reason!: string | null;

    @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
    public created_ts!: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    public updated_ts!: Date | null;

    @BelongsTo(() => AnamAvatar, { foreignKey: "anam_avatar_id", as: "avatar" })
    public avatar!: AnamAvatar | null;
}

export default VaScheduled;

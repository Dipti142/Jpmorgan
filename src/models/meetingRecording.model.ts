import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { IRecordingPart, MeetingRecordingStatus } from "../interfaces/IMeeting.interface";
import MeetingSession from "./meetingSession.model";

@Table({
    tableName: "tl_meeting_recording",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
})
export class MeetingRecording extends Model {
    @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
    public meeting_recording_id!: number;

    @ForeignKey(() => MeetingSession)
    @Column({ type: DataType.BIGINT, allowNull: false })
    public meeting_session_id!: number;

    @Column({ type: DataType.BIGINT, allowNull: false })
    public company_id!: number;

    @Column({ type: DataType.TEXT, allowNull: false })
    public acs_recording_id!: string;

    @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: "STARTED" })
    public status!: MeetingRecordingStatus;

    @Column({ type: DataType.TEXT, allowNull: true })
    public content_location!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    public metadata_location!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    public delete_location!: string | null;

    @Column({ type: DataType.STRING(10), allowNull: true })
    public storage_kind!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    public storage_path!: string | null;

    /** Set only when the recording needed splitting; storage_path is then parts[0]. */
    @Column({ type: DataType.JSONB, allowNull: true })
    public storage_parts!: IRecordingPart[] | null;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
    public chunk_index!: number;

    @Column({ type: DataType.SMALLINT, allowNull: false, defaultValue: 1 })
    public meeting_recording_status!: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
    public meeting_join_attempts!: number;

    @Column({ type: DataType.TEXT, allowNull: true })
    public storage_url!: string | null;

    @Column({ type: DataType.STRING(255), allowNull: true })
    public file_name!: string | null;

    @Column({ type: DataType.BIGINT, allowNull: true })
    public size_bytes!: number | null;

    @Column({ type: DataType.INTEGER, allowNull: true })
    public duration_seconds!: number | null;

    @Column({ type: DataType.JSONB, allowNull: true })
    public event_payload!: Record<string, unknown> | null;

    @Column({ type: DataType.DATE, allowNull: true })
    public started_ts!: Date | null;

    @Column({ type: DataType.DATE, allowNull: true })
    public stopped_ts!: Date | null;

    @Column({ type: DataType.DATE, allowNull: true })
    public stored_ts!: Date | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    public failure_reason!: string | null;

    @BelongsTo(() => MeetingSession)
    public meetingSession!: MeetingSession;
}

export default MeetingRecording;

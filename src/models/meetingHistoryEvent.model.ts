import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { TimelineActorType, TimelineOutcome, TimelineProvider, TimelineTrack } from "../interfaces/IMeetingTimeline.interface";
import Company from "./company.model";
import MeetingSession from "./meetingSession.model";

@Table({
    tableName: "tl_meeting_history_event",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: false,
})
export class MeetingHistoryEvent extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public meeting_history_event_id!: number;

    @ForeignKey(() => Company)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public company_id!: number;

    @ForeignKey(() => MeetingSession)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public meeting_session_id!: number;

    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    public occurred_ts!: Date;

    @Column({
        type: DataType.STRING(40),
        allowNull: false,
    })
    public track!: TimelineTrack;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
    })
    public provider!: TimelineProvider;

    @Column({
        type: DataType.STRING(120),
        allowNull: false,
    })
    public event_type!: string;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
    })
    public outcome!: TimelineOutcome;

    @Column({
        type: DataType.STRING(40),
        allowNull: true,
    })
    public from_status!: string | null;

    @Column({
        type: DataType.STRING(40),
        allowNull: true,
    })
    public to_status!: string | null;

    @Column({
        type: DataType.STRING(20),
        allowNull: true,
    })
    public actor_type!: TimelineActorType | null;

    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public actor_id!: number | null;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    public message!: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public note!: string | null;

    @Column({
        type: DataType.STRING(80),
        allowNull: true,
    })
    public error_code!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public error_message!: string | null;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: {},
    })
    public details!: Record<string, unknown>;
}

export default MeetingHistoryEvent;

import { Column, DataType, HasMany, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { MeetingStatus, MeetingTranscriptionStatus } from "../interfaces/IMeeting.interface";
import MeetingParticipant from "./meetingParticipant.model";

@Table({
    tableName: "tl_meeting_session",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
})
// One meeting, built from an invite mail rather than an API call. The room's
// validity window is not stored: it is derived from start_time and end_time.
export class MeetingSession extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public meeting_session_id!: number;

    /** The external handle. Sequential ids are not quoted at anyone outside. */
    @Column({
        type: DataType.UUID,
        allowNull: false,
        defaultValue: DataType.UUIDV4,
    })
    public uuid!: string;

    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public company_id!: number;

    /** The .ics UID. Unique, so a redelivered invite updates rather than doubles. */
    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public ics_uid!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public source_message_id!: string | null;

    @Column({
        type: DataType.STRING(150),
        allowNull: true,
    })
    public topic!: string | null;

    /** The job role this meeting is for. Trusted, not verified - there is no jobs table. */
    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public job_short_code!: string | null;

    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    public start_time!: Date;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public end_time!: Date | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public room_id!: string | null;

    /** Moderator identity: creates the chat thread, never joins media. */
    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public owner_acs_user_id!: string | null;

    @Column({
        type: DataType.STRING(200),
        allowNull: true,
    })
    public acs_chat_thread_id!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public persona_id!: string | null;

    /** The one link not tied to a person. Token apart from the URL, so a lookup is a lookup. */
    @Column({
        type: DataType.STRING(64),
        allowNull: true,
    })
    public public_token!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public public_link!: string | null;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
        defaultValue: "SCHEDULED",
    })
    public meeting_status!: MeetingStatus;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: Env.virtualAvatar.VA_DEFAULT_MAX_PARTICIPANTS,
    })
    public max_participants!: number;

    /** A counter, so the seat cap is one atomic increment under a row lock. */
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
    })
    public joined_count!: number;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    public recording_requested!: boolean;

    // Call Automation handles. Null until a call runs: the serverCallId does
    // not exist until the connection reaches "connected".
    @Column({
        type: DataType.STRING(200),
        allowNull: true,
    })
    public call_connection_id!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public server_call_id!: string | null;

    @Column({
        type: DataType.STRING(20),
        allowNull: true,
    })
    public transcription_status!: MeetingTranscriptionStatus | null;

    @Column({
        type: DataType.STRING(10),
        allowNull: true,
    })
    public transcription_language!: string | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public first_joined_ts!: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public ended_ts!: Date | null;

    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public end_reason!: string | null;

    /** Null on the mail path - nothing here was done by a person. */
    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public created_by!: number | null;

    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public updated_by!: number | null;

    @Column({
        type: DataType.DATE,
        allowNull: false,
        defaultValue: DataType.NOW,
    })
    public created_at!: Date;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public updated_at!: Date;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public deleted_at!: Date | null;

    @HasMany(() => MeetingParticipant, { foreignKey: "meeting_session_id", as: "participants" })
    public participants!: MeetingParticipant[];
}

export default MeetingSession;

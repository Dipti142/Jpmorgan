import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import {
    MeetingAcsRole,
    MeetingAdmissionState,
    MeetingDenialReason,
    MeetingEmailStatus,
    MeetingRole,
} from "../interfaces/IMeeting.interface";
import MeetingSession from "./meetingSession.model";

@Table({
    tableName: "tl_meeting_participants",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
})
// One address off the invite mail. No company_id: the meeting owns that, and
// this row reaches it through the parent.
export class MeetingParticipant extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public meeting_participant_id!: number;

    @ForeignKey(() => MeetingSession)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public meeting_session_id!: number;

    /** The parent's room, copied, so this table alone answers where someone was sent. */
    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public meeting_session_room_id!: string | null;

    @Column({
        type: DataType.STRING(255),
        allowNull: false,
    })
    public email!: string;

    @Column({
        type: DataType.STRING(150),
        allowNull: true,
    })
    public display_name!: string | null;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
    })
    public role!: MeetingRole;

    /** Matched on email rather than joined: a candidate can be anonymised upstream. */
    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public candidate_id!: string | null;

    /** The ?ref= value. Apart from the link, because this is what is looked up. */
    @Column({
        type: DataType.STRING(64),
        allowNull: false,
    })
    public session_token!: string;

    /** Stored whole: changing the base URL must not break links already sent. */
    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    public session_link!: string;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
        defaultValue: "PENDING",
    })
    public email_status!: MeetingEmailStatus;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public email_sent_ts!: Date | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public email_error!: string | null;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: {},
    })
    public email_template_data!: Record<string, unknown>;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
        defaultValue: "INVITED",
    })
    public admission_state!: MeetingAdmissionState;

    /** Held so a refresh re-mints for the same identity, not a second one. */
    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public acs_user_id!: string | null;

    @Column({
        type: DataType.STRING(20),
        allowNull: true,
    })
    public acs_role!: MeetingAcsRole | null;

    /** DENIED_BY_ORGANISER or LOBBY_TIMEOUT - the join page says something different for each. */
    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public denied_reason!: MeetingDenialReason | null;

    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public decided_by!: number | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public decided_ts!: Date | null;

    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    public seat_no!: number | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public joined_ts!: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public left_ts!: Date | null;

    @Column({
        type: DataType.STRING(64),
        allowNull: true,
    })
    public device_key_hash!: string | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public device_bound_ts!: Date | null;
    
    @Column({
        type: DataType.STRING(10),
        allowNull: true,
    })
    public transcript_language!: string | null;

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

    @BelongsTo(() => MeetingSession, { foreignKey: "meeting_session_id", as: "meeting" })
    public meeting!: MeetingSession;
}

export default MeetingParticipant;

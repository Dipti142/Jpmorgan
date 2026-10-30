import { BelongsTo, Column, DataType, ForeignKey, HasMany, HasOne, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import {
    ICallEscalation,
    ICallParticipant,
    InterviewCallChannel,
    InterviewCallFailureCode,
    InterviewCallStatus,
} from "../interfaces/IInterviewCall.interface";
import AnamAvatar from "./anamAvatar.model";
import Company from "./company.model";
import InterviewCallAnswer from "./interviewCallAnswer.model";
import InterviewCallTurn from "./interviewCallTurn.model";
import MeetingSession from "./meetingSession.model";
import PersonaProgram from "./personaProgram.model";

@Table({
    tableName: "tl_interview_call",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})

export class InterviewCall extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public interview_call_id!: number;

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

    @ForeignKey(() => PersonaProgram)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public persona_program_id!: number;

    /** Snapshot, so a history row reads without joining the interview. */
    @Column({
        type: DataType.STRING(30),
        allowNull: false,
    })
    public interview_reference!: string;

    /** "the third time we tried them" is a column, not a count over rows. */
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 1,
    })
    public attempt_no!: number;

    // What a tool call mid-call resolves the custom script from, so a script
    // reassigned during a live call cannot change the questions under it.
    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public job_short_code!: string | null;

    @Column({
        type: DataType.STRING(150),
        allowNull: true,
    })
    public job_label!: string | null;

    @Column({
        type: DataType.STRING(30),
        allowNull: true,
    })
    public ats_system!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public ats_candidate_id!: string | null;

    /* -- who spoke, as drawn for this call -------------------------------- */

    /** A persona is not a table, so this is the key that resolves it. */
    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public persona_key!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public persona_role!: string | null;

    @ForeignKey(() => AnamAvatar)
    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public anam_avatar_id!: number | null;

    /** Copied, not joined: an avatar can be retired or re-voiced afterwards. */
    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public avatar_key!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public avatar_display_name!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public avatar_model!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public voice_id!: string | null;

    /* -- the candidate, as they were at call time ------------------------- */

    // PII. Snapshotted so a corrected number does not rewrite the history of a
    // call placed to the old one, and cleared through pii_redacted_ts.
    @Column({
        type: DataType.STRING(150),
        allowNull: true,
    })
    public candidate_name!: string | null;

    @Column({
        type: DataType.STRING(255),
        allowNull: true,
    })
    public candidate_email!: string | null;

    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public candidate_phone!: string | null;

    /* -- which knowledge base was in play --------------------------------- */

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public kb_folder!: string | null;

    @Column({
        type: DataType.STRING(60),
        allowNull: true,
    })
    public kb_domain!: string | null;

    /** Which base was configured is not the same as what it actually read. */
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
    })
    public kb_lookup_count!: number;

    /** Who was in the room. PII, so it clears with the contact details. */
    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    public participants!: ICallParticipant[];

    /* -- how the call was carried ----------------------------------------- */

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
        defaultValue: "meeting",
    })
    public channel!: InterviewCallChannel;

    /* -- how it went ------------------------------------------------------ */

    @Column({
        type: DataType.STRING(30),
        allowNull: false,
        defaultValue: "SCHEDULED",
    })
    public call_status!: InterviewCallStatus;

    /** A code to group on; the prose beside it is for a person to read. */
    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public failure_code!: InterviewCallFailureCode | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public failure_reason!: string | null;

    @Column({
        type: DataType.JSONB,
        allowNull: true,
    })
    public error_payload!: Record<string, unknown> | null;

    /** Counted, not a status: a call interrupted twice and finished is complete. */
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
    })
    public interrupted_count!: number;

    /* -- the timeline ------------------------------------------------------ */

    /** When the first participant entered the meeting room, copied off the meeting when the call opens. */
    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public room_initiated_ts!: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: false,
        defaultValue: DataType.NOW,
    })
    public initiated_ts!: Date;

    /** When the persona got in, which is not when the candidate started talking. */
    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public joined_ts!: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public answered_ts!: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public declined_ts!: Date | null;
    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public submitted_ts!: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public ended_ts!: Date | null;

    /** Stored, so a report does not recompute it for every row it returns. */
    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    public duration_seconds!: number | null;

    /* -- recording ---------------------------------------------------------- */

    @Column({
        type: DataType.STRING(150),
        allowNull: true,
    })
    public recording_id!: string | null;

    @Column({
        type: DataType.STRING(20),
        allowNull: true,
    })
    public recording_status!: string | null;

    /** Split from the key so a bucket move is an update of one column. */
    @Column({
        type: DataType.STRING(150),
        allowNull: true,
    })
    public recording_bucket!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public recording_key!: string | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public recording_expires_ts!: Date | null;

    /* -- what the call produced --------------------------------------------- */

    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    public questions_total!: number | null;

    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    public questions_answered!: number | null;

    @Column({
        type: DataType.DECIMAL(3, 2),
        allowNull: true,
    })
    public average_score!: number | null;

    /** Which script the persona actually ran - checklists are editable now. */
    @Column({
        type: DataType.STRING(64),
        allowNull: true,
    })
    public script_hash!: string | null;

    // What the persona could not answer and promised to pass on. On the call
    // rather than in its own table: only ever read with the call it came from.
    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    public escalations!: ICallEscalation[];

    @Column({
        type: DataType.DATE,
        allowNull: false,
        defaultValue: DataType.NOW,
    })
    public created_ts!: Date;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public updated_ts!: Date;

    @BelongsTo(() => MeetingSession, { foreignKey: "meeting_session_id", as: "meeting" })
    public meeting!: MeetingSession;

    @HasMany(() => InterviewCallTurn, { foreignKey: "interview_call_id", as: "turns" })
    public turns!: InterviewCallTurn[];

    // HasOne, enforced by a unique key on the child: record_answer rewrites the
    // one sheet in place rather than appending a second.
    @HasOne(() => InterviewCallAnswer, { foreignKey: "interview_call_id", as: "answerSheet" })
    public answerSheet!: InterviewCallAnswer | null;
}

export default InterviewCall;

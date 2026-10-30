import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { InterviewCallSpeaker } from "../interfaces/IInterviewCall.interface";
import InterviewCall from "./interviewCall.model";

@Table({
    tableName: "tl_interview_call_turn",
    schema: Env.dbPostgres.schema,
    timestamps: false,
})

export class InterviewCallTurn extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public interview_call_turn_id!: number;

    @ForeignKey(() => InterviewCall)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public interview_call_id!: number;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
    })
    public turn_index!: number;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
    })
    public speaker_role!: InterviewCallSpeaker;

    // Free text spoken by a candidate — treat as PHI-bearing
    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    public content!: string;

    /** The provider's own name for the speaker. Null when it does not give one. */
    @Column({
        type: DataType.STRING(150),
        allowNull: true,
    })
    public speaker_label!: string | null;

    /** Per turn, not per call: switching language mid-call is the thing assessed. */
    @Column({
        type: DataType.STRING(20),
        allowNull: true,
    })
    public language_code!: string | null;

    /** Resolved once at write time, so a read never needs a lookup table. */
    @Column({
        type: DataType.STRING(60),
        allowNull: true,
    })
    public language_name!: string | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public spoken_ts!: Date | null;

    /** Offsets into the call - what lines the transcript up with the recording. */
    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    public start_offset_ms!: number | null;

    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    public end_offset_ms!: number | null;

    /** Not a foreign key: the question can be retired, the key is what was quoted. */
    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public question_key!: string | null;

    @Column({
        type: DataType.DATE,
        allowNull: false,
        defaultValue: DataType.NOW,
    })
    public created_ts!: Date;

    @BelongsTo(() => InterviewCall, { foreignKey: "interview_call_id", as: "call" })
    public call!: InterviewCall;
}

export default InterviewCallTurn;

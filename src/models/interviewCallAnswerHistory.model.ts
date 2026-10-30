import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import Company from "./company.model";
import InterviewCall from "./interviewCall.model";

@Table({
    tableName: "tl_interview_call_answer_history",
    schema: Env.dbPostgres.schema,
    timestamps: false,
})
// One row per tool call against one question, appended and never updated. The
// answer sheet says where a question ended up; this says how it got there.
export class InterviewCallAnswerHistory extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public answer_history_id!: number;

    @ForeignKey(() => InterviewCall)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public interview_call_id!: number;

    // Denormalised so a read can be company-scoped without joining the call.
    @ForeignKey(() => Company)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public company_id!: number;

    @Column({
        type: DataType.STRING(100),
        allowNull: false,
    })
    public question_key!: string;

    @Column({
        type: DataType.STRING(30),
        allowNull: true,
    })
    public question_pattern!: string | null;

    // Copied per row so a row reads on its own after the script is reworded.
    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public question_text!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public expected_answer!: string | null;

    /** ask_question | record_answer | verify_contact */
    @Column({
        type: DataType.STRING(60),
        allowNull: false,
    })
    public tool!: string;

    @Column({
        type: DataType.STRING(20),
        allowNull: true,
    })
    public outcome!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public answer!: string | null;
    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public raw_response!: string | null;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: {},
    })
    public captured!: Record<string, unknown>;

    @Column({
        type: DataType.SMALLINT,
        allowNull: true,
    })
    public score!: number | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public asked_ts!: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: false,
        defaultValue: DataType.NOW,
    })
    public tool_called_ts!: Date;

    @Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
    public seconds_since_asked!: number | null;

    @Column({
        type: DataType.DATE,
        allowNull: false,
        defaultValue: DataType.NOW,
    })
    public created_ts!: Date;

    @BelongsTo(() => InterviewCall, { foreignKey: "interview_call_id", as: "call" })
    public call!: InterviewCall;
}

export default InterviewCallAnswerHistory;

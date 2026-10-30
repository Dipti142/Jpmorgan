import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { ICallAnswerEntry, IRawTranscriptEvent } from "../interfaces/IInterviewCall.interface";
import Company from "./company.model";
import InterviewCall from "./interviewCall.model";

@Table({
    tableName: "tl_interview_call_answer",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
// One sheet per call, holding every question and answer in the order asked. A
// child table rather than a column on the call because it is the largest thing
// a call produces and almost every read of a call does not want it.
export class InterviewCallAnswer extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public interview_call_answer_id!: number;

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

    // Ordered inside the document, so reordering rewrites one row.
    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    public answers!: ICallAnswerEntry[];
    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: null,
    })
    public raw_transcript!: IRawTranscriptEvent[] | null;

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
    public updated_ts!: Date | null;

    @BelongsTo(() => InterviewCall, { foreignKey: "interview_call_id", as: "call" })
    public call!: InterviewCall;
}

export default InterviewCallAnswer;

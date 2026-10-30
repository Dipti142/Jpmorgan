import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import Company from "./company.model";
import InterviewCall from "./interviewCall.model";
import MeetingSession from "./meetingSession.model";

@Table({
    tableName: "tl_meeting_history",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
export class MeetingHistory extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public meeting_history_id!: number;

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

    @ForeignKey(() => InterviewCall)
    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public interview_call_id!: number | null;

    @Column({
        type: DataType.STRING(40),
        allowNull: true,
    })
    public final_status!: string | null;
}

export default MeetingHistory;

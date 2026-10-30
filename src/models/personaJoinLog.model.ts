import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { IPersonaJoinLogEntry } from "../interfaces/IVirtualAvatarSession.interface";
import Company from "./company.model";
import MeetingSession from "./meetingSession.model";

@Table({
    tableName: "tl_persona_join_log",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
export class PersonaJoinLog extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public persona_join_log_id!: number;

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
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    public events!: IPersonaJoinLogEntry[];
}

export default PersonaJoinLog;

import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import MeetingParticipant from "./meetingParticipant.model";
import MeetingSession from "./meetingSession.model";

@Table({
    tableName: "tl_meeting_transcript",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
export class MeetingTranscript extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public meeting_transcript_id!: number;

    @ForeignKey(() => MeetingSession)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public meeting_session_id!: number;

    @ForeignKey(() => MeetingParticipant)
    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public meeting_participant_id!: number | null;

    @Column({
        type: DataType.STRING(150),
        allowNull: false,
    })
    public speaker_name!: string;

    @Column({
        type: DataType.STRING(10),
        allowNull: false,
    })
    public language!: string;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    public text!: string;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: {},
    })
    public translations!: Record<string, string>;

    @Column({
        type: DataType.DATE,
        allowNull: false,
        defaultValue: DataType.NOW,
    })
    public created_ts!: Date;
}

export default MeetingTranscript;

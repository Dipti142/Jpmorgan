import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { AiRecommendationStatus as AiRecommendationCode } from "../interfaces/IMeeting.interface";

@Table({
    tableName: "tl_ai_recommendation_status",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
export class AiRecommendationStatus extends Model {
    @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
    public ai_recommendation_status_id!: number;

    @Column({ type: DataType.STRING(20), allowNull: false })
    public status_code!: AiRecommendationCode;

    @Column({ type: DataType.STRING(100), allowNull: false })
    public status_label!: string;

    @Column({ type: DataType.STRING(100), allowNull: false })
    public client_status_label!: string;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
    public display_order!: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
    public is_active!: number;

    @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
    public created_ts!: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    public updated_ts!: Date | null;
}

export default AiRecommendationStatus;

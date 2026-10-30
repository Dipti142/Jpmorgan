import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";

@Table({
    tableName: "tl_va_calendar_block",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: false,
})
export class VaCalendarBlock extends Model {
    @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
    public va_calendar_block_id!: number;

    @Column({ type: DataType.DATEONLY, allowNull: false })
    public block_date!: string;

    @Column({ type: DataType.DATE, allowNull: false })
    public start_ts!: Date;

    @Column({ type: DataType.DATE, allowNull: false })
    public end_ts!: Date;

    @Column({ type: DataType.TEXT, allowNull: false })
    public graph_event_id!: string;

    @Column({ type: DataType.DATE, allowNull: false })
    public synced_ts!: Date;

    @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
    public created_ts!: Date;
}

export default VaCalendarBlock;

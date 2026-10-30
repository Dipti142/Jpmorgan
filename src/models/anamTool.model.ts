import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import Company from "./company.model";

@Table({
    tableName: "tl_anam_tool",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
export class AnamTool extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public anam_tool_id!: number;

    @ForeignKey(() => Company)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public company_id!: number;

    @Column({
        type: DataType.STRING(60),
        allowNull: false,
    })
    public tool_key!: string;

    @Column({
        type: DataType.STRING(80),
        allowNull: false,
    })
    public tool_name!: string;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
    })
    public tool_kind!: string;

    @Column({
        type: DataType.STRING(80),
        allowNull: false,
    })
    public remote_tool_id!: string;

    @Column({
        type: DataType.STRING(64),
        allowNull: true,
    })
    public definition_hash!: string | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public provisioned_ts!: Date | null;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 1,
    })
    public is_active!: number;

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

    @BelongsTo(() => Company, { foreignKey: "company_id", as: "company" })
    public company!: Company;
}

export default AnamTool;

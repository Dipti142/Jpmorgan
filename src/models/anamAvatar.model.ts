import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";

@Table({
    tableName: "tl_anam_avatar",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
export class AnamAvatar extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public anam_avatar_id!: number;

    @Column({
        type: DataType.STRING(50),
        allowNull: false,
        unique: true,
    })
    public avatar_key!: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: false,
    })
    public display_name!: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: false,
    })
    public avatar_id!: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: false,
    })
    public avatar_model!: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: false,
    })
    public voice_id!: string;

    @Column({
        type: DataType.STRING(30),
        allowNull: true,
    })
    public presentation!: string | null;

    @Column({
        type: DataType.STRING(20),
        allowNull: true,
    })
    public locale!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public llm_id!: string | null;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
    })
    public display_order!: number;

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
}

export default AnamAvatar;

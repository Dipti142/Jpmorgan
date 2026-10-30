import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import Company from "./company.model";

@Table({
    tableName: "tl_persona_program",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})

export class PersonaProgram extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public persona_program_id!: number;

    @ForeignKey(() => Company)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public company_id!: number;

    @Column({
        type: DataType.STRING(50),
        allowNull: false,
    })
    public program_key!: string;

    @Column({
        type: DataType.STRING(150),
        allowNull: false,
    })
    public program_name!: string;

    @Column({
        type: DataType.STRING(150),
        allowNull: false,
    })
    public company_name!: string;

    @Column({
        type: DataType.STRING(30),
        allowNull: false,
    })
    public program_kind!: string;

    @Column({
        type: DataType.STRING(60),
        allowNull: true,
    })
    public kb_domain!: string | null;

    // Legacy: predates tl_default_script/tl_custom_script_set and is no longer
    // read by anything - a live call's script comes from those tables instead,
    // through scriptBuilder.service.ts. Kept only because the column exists.
    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    public script!: unknown[];

    @Column({
        type: DataType.STRING(64),
        allowNull: true,
    })
    public script_hash!: string | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public script_synced_ts!: Date | null;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 1,
    })
    public is_active!: number;

    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public updated_by!: number | null;

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

export default PersonaProgram;

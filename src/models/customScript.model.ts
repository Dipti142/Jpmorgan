import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { DefaultScriptRole, ProgramKind } from "../interfaces/IProgram.interface";
import Company from "./company.model";
import CustomScriptTemplate from "./customScriptTemplate.model";

@Table({
    tableName: "tl_custom_script",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
// One row per job role, naming the heading that role runs.
export class CustomScript extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public custom_script_id!: number;

    @ForeignKey(() => Company)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public company_id!: number;

    @ForeignKey(() => CustomScriptTemplate)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public custom_script_template_id!: number;

    @Column({
        type: DataType.STRING(30),
        allowNull: false,
    })
    public program_kind!: ProgramKind;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
    })
    public participant_role!: DefaultScriptRole;

    // What a lookup matches on. The one below is a snapshot for display.
    @Column({
        type: DataType.STRING(50),
        allowNull: false,
    })
    public job_short_code!: string;

    @Column({
        type: DataType.STRING(150),
        allowNull: true,
    })
    public job_label!: string | null;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 1,
    })
    public is_active!: number;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public deleted_ts!: Date | null;

    @Column({
        type: DataType.BIGINT,
        allowNull: true,
    })
    public created_by!: number | null;

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
    public updated_ts!: Date | null;

    @BelongsTo(() => Company, { foreignKey: "company_id", as: "company" })
    public company!: Company;

    @BelongsTo(() => CustomScriptTemplate, {
        foreignKey: "custom_script_template_id",
        as: "template",
    })
    public template!: CustomScriptTemplate;
}

export default CustomScript;

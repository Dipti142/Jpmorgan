import { Column, DataType, HasMany, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import DefaultScript from "./defaultScript.model";
import PersonaProgram from "./personaProgram.model";

@Table({
    tableName: "tl_company",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})

export class Company extends Model {
    @Column({
        type: DataType.BIGINT,
        primaryKey: true,
        allowNull: false,
    })
    public company_id!: number;

    @Column({
        type: DataType.STRING(50),
        allowNull: false,
        unique: true,
    })
    public company_key!: string;

    @Column({
        type: DataType.STRING(150),
        allowNull: false,
    })
    public company_name!: string;

    @Column({
        type: DataType.STRING(30),
        allowNull: false,
    })
    public tool_prefix!: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: false,
    })
    public kb_folder!: string;

    @Column({
        type: DataType.STRING(60),
        allowNull: true,
    })
    public timezone!: string | null;

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

    @HasMany(() => PersonaProgram, { foreignKey: "company_id", as: "programs" })
    public programs!: PersonaProgram[];

    @HasMany(() => DefaultScript, { foreignKey: "company_id", as: "defaultScripts" })
    public defaultScripts!: DefaultScript[];
}

export default Company;

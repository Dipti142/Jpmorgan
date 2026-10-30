import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import {
    DefaultScriptRole,
    DefaultScriptType,
    IDefaultScriptQuestion,
    ProgramKind,
} from "../interfaces/IProgram.interface";
import Company from "./company.model";
import QuestionPattern from "./questionPattern.model";

@Table({
    tableName: "tl_default_script",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})

export class DefaultScript extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public default_script_id!: number;

    @ForeignKey(() => Company)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public company_id!: number;

    @Column({
        type: DataType.STRING(30),
        allowNull: false,
    })
    public program_kind!: ProgramKind;

    @ForeignKey(() => QuestionPattern)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public question_pattern_id!: number;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
    })
    public participant_role!: DefaultScriptRole;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
    })
    public script_type!: DefaultScriptType;

    @Column({
        type: DataType.STRING(50),
        allowNull: false,
    })
    public script_key!: string;

    @Column({
        type: DataType.STRING(150),
        allowNull: false,
    })
    public script_name!: string;

    // Ascending - the order the sets are spoken in.
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
    })
    public script_order!: number;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    public questions!: IDefaultScriptQuestion[];

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

    // Joined on every read that renders a pattern, which is the cost of the id.
    @BelongsTo(() => QuestionPattern, { foreignKey: "question_pattern_id", as: "pattern" })
    public pattern!: QuestionPattern;
}

export default DefaultScript;

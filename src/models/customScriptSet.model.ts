import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { IDefaultScriptQuestion } from "../interfaces/IProgram.interface";
import QuestionPattern from "./questionPattern.model";

@Table({
    tableName: "tl_custom_script_set",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
// One question set of one pattern - the reusable thing a job role points at.
export class CustomScriptSet extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public custom_script_set_id!: number;

    @ForeignKey(() => QuestionPattern)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public question_pattern_id!: number;

    @Column({
        type: DataType.STRING(150),
        allowNull: false,
    })
    public script_name!: string;

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

    // Joined on every read that renders a pattern, which is the cost of the id.
    @BelongsTo(() => QuestionPattern, { foreignKey: "question_pattern_id", as: "pattern" })
    public pattern!: QuestionPattern;
}

export default CustomScriptSet;

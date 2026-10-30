import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { DefaultScriptPattern } from "../interfaces/IProgram.interface";

@Table({
    tableName: "tl_question_pattern",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
// Reference data: one row per pattern, carrying what the pattern implies.
export class QuestionPattern extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public question_pattern_id!: number;

    // What the API speaks. The id is internal.
    @Column({
        type: DataType.STRING(30),
        allowNull: false,
    })
    public pattern_code!: DefaultScriptPattern;

    @Column({
        type: DataType.STRING(100),
        allowNull: false,
    })
    public pattern_label!: string;

    // Stamped on every question in a set of this pattern.
    @Column({
        type: DataType.STRING(30),
        allowNull: false,
    })
    public question_kind!: string;

    // Answers "is this scored" when a question does not say either way.
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    })
    public rating_required_default!: boolean;

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
    public updated_ts!: Date | null;
}

export default QuestionPattern;

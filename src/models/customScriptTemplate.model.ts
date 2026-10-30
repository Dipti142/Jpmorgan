import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { ProgramKind } from "../interfaces/IProgram.interface";
import Company from "./company.model";

@Table({
    tableName: "tl_custom_script_template",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
// The heading - a name, a description, and the sets gathered under it.
export class CustomScriptTemplate extends Model {
    @Column({
        type: DataType.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    })
    public custom_script_template_id!: number;

    @ForeignKey(() => Company)
    @Column({
        type: DataType.BIGINT,
        allowNull: false,
    })
    public company_id!: number;

    // Generated here rather than by the database, so no pgcrypto dependency.
    @Column({
        type: DataType.UUID,
        allowNull: false,
        defaultValue: DataType.UUIDV4,
    })
    public script_uuid!: string;

    @Column({
        type: DataType.STRING(30),
        allowNull: false,
    })
    public program_kind!: ProgramKind;

    @Column({
        type: DataType.STRING(50),
        allowNull: false,
    })
    public template_key!: string;

    @Column({
        type: DataType.STRING(150),
        allowNull: false,
    })
    public template_name!: string;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public template_description!: string | null;

    // The sets under this heading, in speaking order.
    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    public script_set_ids!: number[];

    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 1,
    })
    public is_active!: number;

    // Set alongside is_active going to 0, cleared if the heading is reactivated -
    // matches CustomScript and CustomScriptSet's own retirement signal.
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
}

export default CustomScriptTemplate;

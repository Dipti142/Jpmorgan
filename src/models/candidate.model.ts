import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Env } from "../config/env.config";
import { IWorkableAnswer } from "../interfaces/IWorkable.interface";

@Table({
    tableName: "tl_candidates",
    schema: Env.dbPostgres.schema,
    timestamps: true,
    createdAt: "created_ts",
    updatedAt: "updated_ts",
})
// One row per Workable candidate. candidate_created writes it, candidate_moved
// pushes the stage it is holding into previous_stage before writing the new one.
export class Candidate extends Model {
    /** Workable's id for the candidate - what every webhook for them carries. */
    @Column({
        type: DataType.STRING(100),
        primaryKey: true,
        allowNull: false,
    })
    public candidate_id!: string;

    /** The delivery that last wrote this row. */
    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public event_id!: string | null;

    @Column({
        type: DataType.STRING(200),
        allowNull: true,
    })
    public name!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public firstname!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public lastname!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public headline!: string | null;

    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public job_shortcode!: string | null;

    @Column({
        type: DataType.STRING(200),
        allowNull: true,
    })
    public job_title!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public current_stage!: string | null;

    /** Null until the first move - never seen moving is not the same as unknown. */
    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public previous_stage!: string | null;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    public disqualified!: boolean;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public disqualified_at!: Date | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public disqualification_reason!: string | null;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public profile_url!: string | null;

    @Column({
        type: DataType.STRING(255),
        allowNull: true,
    })
    public address!: string | null;

    @Column({
        type: DataType.STRING(50),
        allowNull: true,
    })
    public phone!: string | null;

    @Column({
        type: DataType.STRING(255),
        allowNull: true,
    })
    public email!: string | null;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
    })
    public common_source!: string | null;

    /** The application form as Workable sends it - the questions differ per job. */
    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    public answers!: IWorkableAnswer[];

    /** Workable's timestamps, not this row's - those are created_ts/updated_ts. */
    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public created_at!: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: true,
    })
    public updated_at!: Date | null;

    /** Presigned and short-lived, so it is rewritten on every webhook. */
    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    public resume_url!: string | null;

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

export default Candidate;

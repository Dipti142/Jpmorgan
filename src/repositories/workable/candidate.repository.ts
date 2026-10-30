import { col, fn, where } from "sequelize";
import Candidate from "../../models/candidate.model";

export type CandidateRow = Partial<Candidate> & { candidate_id: string };

export const findById = async (candidateId: string): Promise<Candidate | null> =>
    Candidate.findByPk(candidateId);

export const findByEmail = async (email: string): Promise<Candidate | null> =>
    Candidate.findOne({
        where: where(fn("lower", col("email")), email.toLowerCase()),
        order: [["created_ts", "DESC"]],
    });

/**
 * Workable retries a delivery until it is acknowledged and sends the same
 * candidate on every event, so the write has to be idempotent on candidate_id.
 */
export const upsert = async (row: CandidateRow): Promise<Candidate> => {
    const existing = await Candidate.findByPk(row.candidate_id);
    if (!existing) return Candidate.create(row);

    existing.set(row);
    await existing.save();
    return existing;
};

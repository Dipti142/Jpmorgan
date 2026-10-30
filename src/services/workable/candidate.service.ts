import { IWorkableCandidate, IWorkableWebhook } from "../../interfaces/IWorkable.interface";
import Candidate from "../../models/candidate.model";
import * as candidateRepo from "../../repositories/workable/candidate.repository";

const toDate = (value?: string | null): Date | null => (value ? new Date(value) : null);

/** Everything a webhook carries about the candidate themselves. */
const toRow = (eventId: string, data: IWorkableCandidate): candidateRepo.CandidateRow => ({
    candidate_id: data.id,
    event_id: eventId,
    name: data.name ?? null,
    firstname: data.firstname ?? null,
    lastname: data.lastname ?? null,
    headline: data.headline ?? null,
    job_shortcode: data.job?.shortcode ?? null,
    job_title: data.job?.title ?? null,
    disqualified: data.disqualified ?? false,
    disqualified_at: toDate(data.disqualified_at),
    disqualification_reason: data.disqualification_reason ?? null,
    profile_url: data.profile_url ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    common_source: data.common_source ?? null,
    answers: data.answers ?? [],
    created_at: toDate(data.created_at),
    updated_at: toDate(data.updated_at),
    resume_url: data.resume_url ?? null,
});

export const recordCandidateCreated = async (event: IWorkableWebhook): Promise<Candidate> =>
    candidateRepo.upsert({
        ...toRow(event.id, event.data),
        current_stage: event.data.stage ?? null,
    });

/**
 * The stage the row is holding becomes previous_stage and the one in the event
 * becomes current. A redelivery of the same move must not shift a stage onto
 * itself, so an unchanged stage leaves previous_stage where it is - and a move
 * arriving before the create still writes a full row, with nothing behind it.
 */
export const recordCandidateMoved = async (event: IWorkableWebhook): Promise<Candidate> => {
    const existing = await candidateRepo.findById(event.data.id);
    const stage = event.data.stage ?? null;

    const previousStage =
        existing && existing.current_stage !== stage
            ? existing.current_stage
            : (existing?.previous_stage ?? null);

    return candidateRepo.upsert({
        ...toRow(event.id, event.data),
        current_stage: stage,
        previous_stage: previousStage,
    });
};

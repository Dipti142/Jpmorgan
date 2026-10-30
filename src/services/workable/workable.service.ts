import { workableApi } from "../../config/axios.config";
import {
    IWorkableCandidate,
    IWorkableCandidateSearchResult,
    IWorkableEvent,
    IWorkableEventSearchResult,
    IWorkableJob,
    IWorkableJobPage,
    IWorkableMember,
    IWorkableMemberSearchResult,
    WorkableJobState,
} from "../../interfaces/IWorkable.interface";

export const fetchJobs = async (state: WorkableJobState): Promise<IWorkableJob[]> => {
    const jobs: IWorkableJob[] = [];
    let page = await workableApi.get<IWorkableJobPage>("/jobs", { params: { state } });

    jobs.push(...(page.data?.jobs ?? []));
    while (page.data?.paging?.next) {
        page = await workableApi.get<IWorkableJobPage>(page.data.paging.next);
        jobs.push(...(page.data?.jobs ?? []));
    }

    return jobs;
};

export const fetchJobByShortcode = async (shortcode: string): Promise<IWorkableJob | null> => {
    const { data } = await workableApi.get<IWorkableJob>(`/jobs/${encodeURIComponent(shortcode)}`);
    return data?.shortcode ? data : null;
};

export const findCandidatesByEmail =async (email: string): Promise<IWorkableCandidate[]> => {
    const { data } = await workableApi.get<IWorkableCandidateSearchResult>("/candidates", {
        params: { email },
    });
    return data?.candidates ?? [];
};

export const fetchCandidateById = async (candidateId: string): Promise<IWorkableCandidate | null> => {
    const { data } = await workableApi.get<IWorkableCandidateSearchResult>(
        `/candidates/${encodeURIComponent(candidateId)}`,
    );
    return data?.candidate?.id ? data.candidate : null;
};

export const findMembersByEmail = async (email: string): Promise<IWorkableMember[]> => {
    const { data } = await workableApi.get<IWorkableMemberSearchResult>("/members", {
        params: { email },
    });
    return data?.members ?? [];
};

export const findCandidateEvents = async (input: {
    candidateId?: string;
    startDate: string;
    endDate: string;
}): Promise<IWorkableEvent[]> => {
    const { data } = await workableApi.get<IWorkableEventSearchResult>("/events", {
        params: {
            ...(input.candidateId ? { candidate_id: input.candidateId } : {}),
            start_date: input.startDate,
            end_date: input.endDate,
        },
    });
    return data?.events ?? [];
};

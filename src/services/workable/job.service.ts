import { trace, traceFailure } from "../../helpers/trace.helper";
import { toIcsStamp } from "../../helpers/ics.helper";
import { IMeetingRecipient } from "../../interfaces/IMeeting.interface";
import {
    IWorkableActiveTemplate,
    IWorkableJob,
    IWorkableJobMatch,
    IWorkableJobView,
    WorkableJobState,
} from "../../interfaces/IWorkable.interface";
import * as customScripts from "../../repositories/customScript.repository";
import { resolveRole } from "../meeting/meetingRole.service";
import * as workable from "./workable.service";

const candidateEmails = (recipients: IMeetingRecipient[]): string[] => [
    ...new Set(
        recipients
            .map((recipient) => recipient.email.trim().toLowerCase())
            .filter((email) => email && resolveRole(email) === "CANDIDATE"),
    ),
];

const findMatch = async (input: {
    title: string | null;
    recipients: IMeetingRecipient[];
    startsAt: Date;
    endsAt: Date;
}): Promise<IWorkableJobMatch | null> => {
    const startDate = toIcsStamp(input.startsAt);
    const endDate = toIcsStamp(input.endsAt);
    const emails = candidateEmails(input.recipients);

    // A native Outlook invite only carries the candidate's masked alias, so the
    // interview is found by its own slot and title instead of by address.
    const wanted = input.title?.trim().toLowerCase();
    if (wanted && emails.length > 0) {
        const scheduled = await workable.findCandidateEvents({ startDate, endDate });
        const booked = scheduled.find(
            (event) =>
                !event.cancelled &&
                event.job?.shortcode &&
                event.candidate?.id &&
                event.title?.trim().toLowerCase() === wanted,
        );

        if (booked?.job?.shortcode && booked.candidate?.id) {
            // Kept non-fatal: losing the address must not discard a proven job match.
            const candidate = await workable.fetchCandidateById(booked.candidate.id).catch(() => null);

            return {
                shortcode: booked.job.shortcode,
                title: booked.job.title ?? null,
                candidateId: booked.candidate.id,
                candidateName: candidate?.name ?? booked.candidate.name ?? null,
                candidateEmail: candidate?.email?.trim().toLowerCase() || emails[0],
                eventId: booked.id ?? null,
            };
        }
    }

    for (const email of emails) {
        for (const candidate of await workable.findCandidatesByEmail(email)) {
            if (!candidate.id) continue;

            const events = await workable.findCandidateEvents({
                candidateId: candidate.id,
                startDate,
                endDate,
            });

            const booked = events.find((event) => !event.cancelled && event.job?.shortcode);
            if (!booked?.job?.shortcode) continue;

            return {
                shortcode: booked.job.shortcode,
                title: booked.job.title ?? null,
                candidateId: candidate.id,
                candidateName: candidate.name ?? null,
                candidateEmail: email,
                eventId: booked.id ?? null,
            };
        }
    }

    return null;
};

export const matchJobForInvite = async (input: {
    reference: string;
    title: string | null;
    recipients: IMeetingRecipient[];
    startsAt: Date;
    endsAt: Date;
}): Promise<IWorkableJobMatch | null> => {
    try {
        const match = await findMatch(input);

        trace("workable", input.reference, match ? "job_matched" : "job_unmatched", {
            shortcode: match?.shortcode ?? null,
            title: match?.title ?? null,
            candidateId: match?.candidateId ?? null,
            candidateEmail: match?.candidateEmail ?? null,
            eventId: match?.eventId ?? null,
        });

        return match;
    } catch (error) {
        traceFailure("workable", input.reference, "job_match", error);
        return null;
    }
};

export const findJobDetails = async (
    shortcode: string,
): Promise<{ title: string; location: string | null } | null> => {
    try {
        const job = await workable.fetchJobByShortcode(shortcode);
        if (!job) return null;

        return { title: job.title, location: job.location?.location_str ?? null };
    } catch (error) {
        traceFailure("workable", shortcode, "job_lookup", error);
        return null;
    }
};

const jobView = (
    job: IWorkableJob,
    activeTemplates: Map<string, IWorkableActiveTemplate>,
): IWorkableJobView => ({
    id: job.id,
    shortcode: job.shortcode,
    title: job.title,
    fullTitle: job.full_title ?? null,
    state: job.state,
    department: job.department ?? null,
    location: job.location?.location_str ?? null,
    workplaceType: job.workplace_type ?? null,
    url: job.url ?? null,
    applicationUrl: job.application_url ?? null,
    createdAt: job.created_at ?? null,
    activeTemplate: activeTemplates.get(job.shortcode) ?? null,
});

const activeTemplatesByJob = async (companyId: number): Promise<Map<string, IWorkableActiveTemplate>> => {
    const rows = await customScripts.listAssignments(companyId);
    const map = new Map<string, IWorkableActiveTemplate>();

    for (const row of rows) {
        if (row.program_kind !== "INTERVIEW" || row.participant_role !== "AGENT" || !row.template) continue;
        map.set(row.job_short_code, { scriptUuid: row.template.script_uuid, templateName: row.template.template_name });
    }

    return map;
};

export const listJobs = async (input: {
    state: WorkableJobState;
    companyId: number;
    limit: number;
    offset: number;
}) => {
    const [jobs, activeTemplates] = await Promise.all([
        workable.fetchJobs(input.state),
        activeTemplatesByJob(input.companyId),
    ]);
    const page = jobs.slice(input.offset, input.offset + input.limit);

    return {
        total: jobs.length,
        limit: input.limit,
        offset: input.offset,
        jobs: page.map((job) => jobView(job, activeTemplates)),
    };
};

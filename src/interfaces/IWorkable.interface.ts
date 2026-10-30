/**
 * The parts of a Workable candidate webhook this service reads. Workable sends
 * a great deal more per delivery - education, experience, tags, location - and
 * what is not typed here is not stored.
 */

/**
 * One entry of the application form. The shape varies by question type - free
 * text answers in `body`, choice answers in `choices`, files in `file_url` -
 * so the entry is kept whole rather than flattened into a column.
 */
export interface IWorkableAnswer {
    question?: { id?: string | null; body?: string | null; type?: string | null } | null;
    body?: string | null;
    answer?: string | null;
    choices?: unknown;
    checked?: boolean | null;
    date?: string | null;
    file_url?: string | null;
    [key: string]: unknown;
}

export interface IWorkableCandidate {
    id: string;
    name?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    headline?: string | null;
    job?: { shortcode?: string | null; title?: string | null } | null;
    stage?: string | null;
    stage_kind?: string | null;
    disqualified?: boolean | null;
    disqualified_at?: string | null;
    disqualification_reason?: string | null;
    profile_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    common_source?: string | null;
    answers?: IWorkableAnswer[] | null;
    created_at?: string | null;
    updated_at?: string | null;
    resume_url?: string | null;
}

export interface IWorkableWebhook {
    event_type: string;
    id: string;
    fired_at?: string;
    resource_type?: string;
    data: IWorkableCandidate;
}

export interface IWorkableCandidateSearchResult {
    candidates?: IWorkableCandidate[] | null;
    candidate?: IWorkableCandidate | null;
}

export interface IWorkableMember {
    id: string;
    name?: string | null;
    email?: string | null;
    active?: boolean | null;
}

export interface IWorkableMemberSearchResult {
    members?: IWorkableMember[] | null;
}

export interface IWorkableEvent {
    id?: string | null;
    title?: string | null;
    type?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    cancelled?: boolean | null;
    job?: { shortcode?: string | null; title?: string | null } | null;
    candidate?: { id?: string | null; name?: string | null } | null;
}

export interface IWorkableEventSearchResult {
    events?: IWorkableEvent[] | null;
}

export type WorkableJobState = "draft" | "published" | "archived" | "closed";

export interface IWorkableJob {
    id: string;
    title: string;
    full_title?: string | null;
    shortcode: string;
    state: WorkableJobState;
    department?: string | null;
    url?: string | null;
    application_url?: string | null;
    workplace_type?: string | null;
    location?: { location_str?: string | null } | null;
    created_at?: string | null;
}

export interface IWorkableJobPage {
    jobs?: IWorkableJob[] | null;
    paging?: { next?: string | null } | null;
}

export interface IWorkableActiveTemplate {
    scriptUuid: string;
    templateName: string;
}

export interface IWorkableJobView {
    id: string;
    shortcode: string;
    title: string;
    fullTitle: string | null;
    state: WorkableJobState;
    department: string | null;
    location: string | null;
    workplaceType: string | null;
    url: string | null;
    applicationUrl: string | null;
    createdAt: string | null;
    activeTemplate: IWorkableActiveTemplate | null;
}

export interface IWorkableJobMatch {
    shortcode: string;
    title: string | null;
    candidateId: string;
    candidateName: string | null;
    candidateEmail: string;
    eventId: string | null;
}

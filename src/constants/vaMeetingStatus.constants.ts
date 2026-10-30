import { IVaMeetingStatusSeed } from "../interfaces/IMeeting.interface";

export const VA_MEETING_STATUSES: IVaMeetingStatusSeed[] = [
    {
        status_code: "UNASSIGNED",
        status_label: "Unassigned",
        client_status_label: "Interview Unassigned",
        meeting_status_code: null,
        display_order: 1,
    },
    {
        status_code: "SCHEDULED",
        status_label: "Scheduled",
        client_status_label: "Interview Scheduled",
        meeting_status_code: null,
        display_order: 2,
    },
    {
        status_code: "ONGOING",
        status_label: "Ongoing",
        client_status_label: "Interview In Progress",
        meeting_status_code: "ACTIVE",
        display_order: 3,
    },
    {
        status_code: "COMPLETED",
        status_label: "Completed",
        client_status_label: "Interview Completed",
        meeting_status_code: "ENDED",
        display_order: 4,
    },
    {
        status_code: "MISSED",
        status_label: "Missed",
        client_status_label: "Interview Missed",
        meeting_status_code: "EXPIRED",
        display_order: 5,
    },
    {
        status_code: "CANCELLED",
        status_label: "Cancelled",
        client_status_label: "Interview Cancelled",
        meeting_status_code: "CANCELLED",
        display_order: 6,
    },
    {
        status_code: "INTERRUPTED",
        status_label: "Interrupted",
        client_status_label: "Interview Interrupted",
        meeting_status_code: null,
        display_order: 7,
    },
    {
        status_code: "RESCHEDULED",
        status_label: "Rescheduled",
        client_status_label: "Interview Rescheduled",
        meeting_status_code: null,
        display_order: 8,
    },
];

export default VA_MEETING_STATUSES;

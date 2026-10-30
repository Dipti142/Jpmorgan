import { IAiRecommendationStatusSeed } from "../interfaces/IMeeting.interface";

export const AI_RECOMMENDATION_STATUSES: IAiRecommendationStatusSeed[] = [
    {
        status_code: "PASSED",
        status_label: "Passed",
        client_status_label: "Interview Passed",
        display_order: 1,
    },
    {
        status_code: "FAILED",
        status_label: "Failed",
        client_status_label: "Interview Failed",
        display_order: 2,
    },
    {
        status_code: "ONHOLD",
        status_label: "On Hold",
        client_status_label: "Interview On Hold",
        display_order: 3,
    },
];

export default AI_RECOMMENDATION_STATUSES;

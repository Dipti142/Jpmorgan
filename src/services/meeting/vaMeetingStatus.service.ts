import { IAiRecommendationStatusView, IVaMeetingStatusView } from "../../interfaces/IMeeting.interface";
import * as repository from "../../repositories/meeting/vaMeetingStatus.repository";

export const listStatuses = async (): Promise<IVaMeetingStatusView[]> => {
    const statuses = await repository.listActive();
    const statusList = statuses.map((status) => ({
        vaStatusId: status.va_meeting_status_id,
        code: status.status_code,
        label: status.status_label,
        clientLabel: status.client_status_label,
        meetingStatus: status.meeting_status_code,
        order: status.display_order,
    }))
    return statusList;
};

export const listAiRecommendationStatuses = async (): Promise<IAiRecommendationStatusView[]> => {
    const statuses = await repository.listActiveAiRecommendations();

    return statuses.map((status) => ({
        recommendationId: status.ai_recommendation_status_id,
        code: status.status_code,
        label: status.status_label,
        clientLabel: status.client_status_label,
        order: status.display_order,
    }));
};

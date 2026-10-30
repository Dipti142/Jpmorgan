import { Transaction } from "sequelize";
import { MeetingStatus, VaScheduleStatus } from "../../interfaces/IMeeting.interface";
import AiRecommendationStatus from "../../models/aiRecommendationStatus.model";
import VaMeetingStatus from "../../models/vaMeetingStatus.model";

export const listActive = async (): Promise<VaMeetingStatus[]> =>
    VaMeetingStatus.findAll({
        where: { is_active: 1 },
        order: [["display_order", "ASC"]],
    });

export const listActiveAiRecommendations = async (): Promise<AiRecommendationStatus[]> =>
    AiRecommendationStatus.findAll({
        where: { is_active: 1 },
        order: [["display_order", "ASC"]],
    });

export const findActiveAiRecommendationById = async (
    aiRecommendationStatusId: number,
): Promise<AiRecommendationStatus | null> =>
    AiRecommendationStatus.findOne({
        where: { ai_recommendation_status_id: aiRecommendationStatusId, is_active: 1 },
    });

export const requireByCode = async (
    code: VaScheduleStatus,
    transaction?: Transaction,
): Promise<VaMeetingStatus> => {
    const status = await VaMeetingStatus.findOne({ where: { status_code: code }, transaction });
    if (!status) throw new Error(`No status ${code} in tl_va_meeting_status`);
    return status;
};

export const findMeetingStatusFor = async (
    code: VaScheduleStatus,
    transaction?: Transaction,
): Promise<MeetingStatus | null> => {
    const status = await VaMeetingStatus.findOne({ where: { status_code: code }, transaction });
    return status?.meeting_status_code ?? null;
};

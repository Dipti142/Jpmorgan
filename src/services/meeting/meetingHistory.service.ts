import { eventDraft, failureDraft } from "../../helpers/meetingHistory.helper";
import { IHistoryEntryInput, IHistoryScope } from "../../interfaces/IMeetingTimeline.interface";
import MeetingSession from "../../models/meetingSession.model";
import * as historyRepo from "../../repositories/meeting/meetingHistory.repository";

export const scopeOfMeeting = (meeting: MeetingSession, interviewCallId?: number | null): IHistoryScope => ({
    companyId: Number(meeting.company_id),
    meetingSessionId: Number(meeting.meeting_session_id),
    interviewCallId,
    reference: meeting.uuid,
});

export const recordEvent = async (scope: IHistoryScope, input: IHistoryEntryInput): Promise<void> =>
    historyRepo.tryAppendEntry({ ...scope, draft: eventDraft(input) });

export const recordFailure = async (
    scope: IHistoryScope,
    input: IHistoryEntryInput,
    error: unknown,
): Promise<void> => historyRepo.tryAppendEntry({ ...scope, draft: failureDraft(input, error) });

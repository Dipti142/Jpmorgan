import MeetingTranscript from "../../models/meetingTranscript.model";

export const createLine = async (input: {
    meetingSessionId: number;
    participantId: number | null;
    speakerName: string;
    language: string;
    text: string;
    translations: Record<string, string>;
}): Promise<MeetingTranscript> =>
    MeetingTranscript.create({
        meeting_session_id: input.meetingSessionId,
        meeting_participant_id: input.participantId,
        speaker_name: input.speakerName,
        language: input.language,
        text: input.text,
        translations: input.translations,
    });

export const listForMeeting = async (meetingSessionId: number): Promise<MeetingTranscript[]> =>
    MeetingTranscript.findAll({
        where: { meeting_session_id: meetingSessionId },
        order: [["meeting_transcript_id", "ASC"]],
    });

export const findLine = async (
    meetingSessionId: number,
    lineId: number,
): Promise<MeetingTranscript | null> =>
    MeetingTranscript.findOne({ where: { meeting_session_id: meetingSessionId, meeting_transcript_id: lineId } });

export const setTranslations = async (
    line: MeetingTranscript,
    translations: Record<string, string>,
): Promise<void> => {
    line.set({ translations });
    await line.save();
};

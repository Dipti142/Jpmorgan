import { types } from 'pg';
import { Sequelize } from "sequelize-typescript";
import { Env } from "../config/env.config";
import dbConfig from "../config/database";
import { AnamAvatar } from "./anamAvatar.model";
import { ApplicationDetails } from "./applicationDetails.model";
import { AnamTool } from "./anamTool.model";
import { Candidate } from "./candidate.model";
import { Company } from "./company.model";
import { CustomScript } from "./customScript.model";
import { CustomScriptSet } from "./customScriptSet.model";
import { CustomScriptTemplate } from "./customScriptTemplate.model";
import { DefaultScript } from "./defaultScript.model";
import { InterviewCall } from "./interviewCall.model";
import { InterviewCallAnswer } from "./interviewCallAnswer.model";
import { InterviewCallAnswerHistory } from "./interviewCallAnswerHistory.model";
import { InterviewCallTurn } from "./interviewCallTurn.model";
import { MeetingParticipant } from "./meetingParticipant.model";
import { MeetingRecording } from "./meetingRecording.model";
import { MeetingSession } from "./meetingSession.model";
import { MeetingTranscript } from "./meetingTranscript.model";
import { MeetingHistory } from "./meetingHistory.model";
import { MeetingHistoryEvent } from "./meetingHistoryEvent.model";
import { PersonaJoinLog } from "./personaJoinLog.model";
import { PersonaProgram } from "./personaProgram.model";
import { QuestionPattern } from "./questionPattern.model";
import { AiRecommendationStatus } from "./aiRecommendationStatus.model";
import { VaCalendarBlock } from "./vaCalendarBlock.model";
import { VaScheduled } from "./vaScheduled.model";
import { VaMeetingStatus } from "./vaMeetingStatus.model";

types.setTypeParser(20, (val: string) => Number.parseInt(val, 10));
export const connection: Sequelize = new Sequelize({
  dialect: "postgres",
  host: dbConfig.HOST,
  port: dbConfig.PORT,
  username: dbConfig.USER,
  password: dbConfig.PASSWORD,
  database: dbConfig.DB,
  schema: Env.dbPostgres.schema,
  logging: dbConfig.LOGGING,
  pool: dbConfig.pool,
  dialectOptions: {
    useUTC: true,
  },
  models: [
    Company,
    PersonaProgram,
    QuestionPattern,
    DefaultScript,
    CustomScriptSet,
    CustomScriptTemplate,
    CustomScript,
    InterviewCall,
    InterviewCallTurn,
    InterviewCallAnswer,
    InterviewCallAnswerHistory,
    AnamAvatar,
    AnamTool,
    Candidate,
    MeetingSession,
    MeetingRecording,
    MeetingParticipant,
    MeetingTranscript,
    VaMeetingStatus,
    AiRecommendationStatus,
    VaScheduled,
    VaCalendarBlock,
    ApplicationDetails,
    PersonaJoinLog,
    MeetingHistory,
    MeetingHistoryEvent,
  ],
});

export {
  Company,
  PersonaProgram,
  QuestionPattern,
  DefaultScript,
  CustomScriptSet,
  CustomScriptTemplate,
  CustomScript,
  InterviewCall,
  InterviewCallTurn,
  InterviewCallAnswer,
  InterviewCallAnswerHistory,
  AnamAvatar,
  AnamTool,
  Candidate,
  MeetingSession,
  MeetingParticipant,
  MeetingTranscript,
  MeetingRecording,
  VaMeetingStatus,
  AiRecommendationStatus,
  VaScheduled,
  VaCalendarBlock,
  ApplicationDetails,
  PersonaJoinLog,
  MeetingHistory,
  MeetingHistoryEvent,
};

export default connection;

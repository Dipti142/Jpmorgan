import dotenv from "dotenv-flow";
dotenv.config();

const NODE_ENV: string = process.env.NODE_ENV || "development";

const ACS_ENDPOINT = (process.env.AZURE_CONNECTION_URL ?? "").replace(/\/$/, "");
const ACS_ACCESS_KEY = process.env.AZURE_ACCESS_TOKEN ?? "";

// The one public origin this service is reachable on. Every callback Anam, ACS
// and Graph post back to is built from it, and so is the join link.
const BASE_URL = (process.env.AGENTIC_AVATAR_BASE_URL ?? "").trim().replace(/\/+$/, "");
const VA_JOIN_PATH = `/${(process.env.VA_JOIN_PATH ?? "/join").trim().replace(/^\/+|\/+$/g, "")}`;
const AZURE_AI_SERVICES_REGION = (process.env.AZURE_AI_SERVICES_REGION ?? "").trim();


let successTable = "aiAgentAvatar_dev";
let errorTable = "aiAgentAvatarErrors_dev";
if (NODE_ENV === "production") {
    successTable = "aiAgentAvatar_prod";
    errorTable = "aiAgentAvatarErrors_prod";
} else if (NODE_ENV === "staging") {
    successTable = "aiAgentAvatar_staging";
    errorTable = "aiAgentAvatarErrors_staging";
}

export const Env = {
    server_port: Number(process.env.PORT ?? 9636),
    node_environment: NODE_ENV,
    is_production: NODE_ENV === "production",
    allowed_origins: process.env.ALLOWED_ORIGINS,
    base_url: BASE_URL,
    jwt: {
        private_secret: process.env.JWT_SECRET_KEY!,
        refresh_private_secret: process.env.JWT_REFRESH_SECRET_KEY!,
        public_secret: "",
        issuer: process.env.JWT_ISSUER!,
        audience: process.env.JWT_AUDIENCE!,
        access_token_expires: "5d",
        refresh_token_expires: "7d",
        mobile_api_access_key: process.env.MOBILE_API_ACCESS_KEY ?? "",
    },
    microserviceUrl: {
        user_microservices_url: process.env.USER_AUTHENTICATION_MICROSERVICES ?? "",
    },
    dbPostgres: {
        host: process.env.DB_HOST!,
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_DATABASE!,
        port: Number(process.env.DB_PORT ?? 5432),
        schema: process.env.DB_SCHEMA ?? "onboarding_persona",
        ssl: process.env.DB_SSL === "true",
    },
    anam: {
        api_base_url: (process.env.ANAM_API_BASE_URL ?? "https://api.anam.ai/v1").replace(/\/$/, ""),
        public_base_url: BASE_URL,
        anam_api_key: process.env.ANAM_API_KEY ?? "",
        tool_shared_secret: process.env.ANAM_TOOL_SHARED_SECRET ?? "",
        knowledge_group_id: process.env.ANAM_KNOWLEDGE_GROUP_ID ?? "",
        knowledge_dir: process.env.ANAM_KNOWLEDGE_DIR ?? "knowledge",
        video_quality: process.env.ANAM_VIDEO_QUALITY ?? "high",
        video_width: Number(process.env.ANAM_VIDEO_WIDTH ?? 1152),
        video_height: Number(process.env.ANAM_VIDEO_HEIGHT ?? 768),
        meeting_video_options: (process.env.ANAM_MEETING_VIDEO_OPTIONS ?? "false") === "true",
        uninterruptible_greeting: (process.env.ANAM_UNINTERRUPTIBLE_GREETING ?? "true") === "true",
    },
    acs: {
        ACS_ENDPOINT: ACS_ENDPOINT,
        ACS_ACCESS_KEY: ACS_ACCESS_KEY,
        ACS_CONNECTION_STRING:`endpoint=${ACS_ENDPOINT}/;accesskey=${ACS_ACCESS_KEY}`,
        ACS_WEBHOOK_SECRET: process.env.ACS_WEBHOOK_SECRET ?? "",
    },
    azureAi: {
        AZURE_AI_SERVICES_ENDPOINT: (process.env.AZURE_COGNITIVE_SERVICES ?? "").trim(),
        AZURE_AI_SERVICES_KEY: (process.env.AZURE_AI_SERVICES_KEY ?? "").trim(),
        AZURE_AI_SERVICES_REGION,
        AZURE_TRANSLATOR_ENDPOINT: (process.env.AZURE_TRANSLATOR_ENDPOINT || "https://api.cognitive.microsofttranslator.com").replace(/\/+$/, ""),
        AZURE_TTS_ENDPOINT: (process.env.AZURE_TTS_ENDPOINT || `https://${AZURE_AI_SERVICES_REGION}.tts.speech.microsoft.com`).replace(/\/+$/, ""),
    },
    virtualAvatar: {
        VA_JOIN_BASE_URL: BASE_URL ? `${BASE_URL}${VA_JOIN_PATH}` : "",
        VA_DEFAULT_MAX_PARTICIPANTS: Number(process.env.VA_DEFAULT_MAX_PARTICIPANTS ?? 5),
        VA_SEAT_CEILING: Number(process.env.VA_SEAT_CEILING ?? 20),
        VA_LOBBY_TIMEOUT_MINUTES: Number(process.env.VA_LOBBY_TIMEOUT_MINUTES ?? 10),
        VA_FILE_SERVICE_URL: (process.env.VA_FILE_SERVICE_URL ?? "").replace(/\/+$/, ""),
        VA_FILE_SERVICE_API_KEY: process.env.VA_FILE_SERVICE_API_KEY ?? "",
        VA_FILE_SERVICE_BUCKET: process.env.VA_FILE_SERVICE_BUCKET ?? "",
        VA_FILE_SERVICE_PATH: process.env.VA_FILE_SERVICE_PATH ?? "TotalLanguage/agentic-recording",
        VA_RECORDING_URL_TTL_SECONDS: Number(process.env.VA_RECORDING_URL_TTL_SECONDS ?? 3600),
        VA_RECORDING_MAX_PART_BYTES: Number(process.env.VA_RECORDING_MAX_PART_BYTES ?? 41_943_040),
        VA_RECORD_MEETINGS: (process.env.VA_RECORD_MEETINGS ?? "true") === "true",
        VA_TRANSCRIBE_MEETINGS: (process.env.VA_TRANSCRIBE_MEETINGS ?? "false") === "true",
        VA_TRANSCRIPTION_LANGUAGE: (process.env.VA_TRANSCRIPTION_LANGUAGE ?? "en").trim(),
        VA_ORGANISER_EMAIL_DOMAIN: (process.env.VA_ORGANISER_EMAIL_DOMAIN ?? "baystateinterpreters.com").toLowerCase(),
        VA_AGENT_EMAILS: (process.env.VA_AGENT_EMAILS ?? "agent@baystateinterpreters.com")
            .split(",")
            .map((address) => address.trim().toLowerCase())
            .filter(Boolean),
    },
    meeting: {
        AGENT_EMAIL_ID: (process.env.AGENT_EMAIL_ID ?? "").trim().toLowerCase(),
        MEETING_ORGANIZER_EMAIL_DOMAIN: (process.env.MEETING_ORGANIZER_EMAIL_DOMAIN ?? "ailogic.com").toLowerCase(),
        MEETING_OPENS_MINUTES_BEFORE: Number(process.env.MEETING_OPENS_MINUTES_BEFORE ?? 10),
        MEETING_DEFAULT_DURATION_MINUTES: Number(process.env.MEETING_DEFAULT_DURATION_MINUTES ?? 60,),
        MEETING_DEFAULT_COMPANY_ID: Number(process.env.MEETING_DEFAULT_COMPANY_ID ?? 7),
        MEETING_BUFFER_MINUTES: Number(process.env.MEETING_BUFFER_MINUTES ?? 15),
        MEETING_BLOCK_TIMEZONE: process.env.MEETING_BLOCK_TIMEZONE ?? "Asia/Kolkata",
        MEETING_BLOCK_PUBLISH_MODE: process.env.MEETING_BLOCK_PUBLISH_MODE ?? "raw",
    },
    mail: {
        MAIL_HOST: process.env.MAIL_HOST ?? "",
        MAIL_PORT: Number(process.env.MAIL_PORT ?? 587),
        MAIL_USERNAME: process.env.MAIL_USERNAME ?? "",
        MAIL_PASSWORD: process.env.MAIL_PASSWORD ?? "",
        MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL ?? "",
        MAIL_FROM_NAME: process.env.MAIL_FROM_NAME ?? "Baystate Interpreters",
        CANDIDATE_REGISTRATION_URL: (process.env.CANDIDATE_REGISTRATION_URL ?? "").trim(),
    },
    dynamoDB: {
        successTable,
        errorTable,
        successTableIndex: "UserIdIndex",
        localEndpoint: NODE_ENV === "development" ? (process.env.DYNAMODB_LOCAL_ENDPOINT ?? "http://localhost:8000") : "",
    },
    awsSdk: {
        AWS_ACCESS_KEY: process.env.CLOUD_WATCH_ACCESS_KEY_ID ?? "",
        AWS_SECRET_KEY: process.env.CLOUD_WATCH_SECRET_KEY ?? "",
        AWS_WATCH_REGION: process.env.CLOUD_WATCH_AWS_REGION ?? "us-west-2",
    },
    workable: {
        WORKABLE_BASE_URL: (process.env.WORKABLE_BASE_URL ?? "").replace(/\/+$/, ""),
        WORKABLE_AUTH_TOKEN: (process.env.WORKABLE_AUTH_TOKEN ?? "").trim(),
        WORKABLE_INVITE_SENDER_NAME: process.env.WORKABLE_INVITE_SENDER_NAME ?? "Baystate Interpreters",
        WORKABLE_INVITE_SENDER_DOMAIN: process.env.WORKABLE_INVITE_SENDER_DOMAIN ?? "events.workablemail.com",
        STAFF_INVITE_SENDER_DOMAIN: process.env.STAFF_INVITE_SENDER_DOMAIN ?? "baystateinterpreters.com",
    },
    teams: {
        TEAMS_TENANT_ID: process.env.TEAMS_TENANT_ID ?? "",
        TEAMS_CLIENT_ID: process.env.TEAMS_CLIENT_ID ?? "",
        TEAMS_CLIENT_SECRET: process.env.TEAMS_CLIENT_SECRET ?? "",
        AGENT_MAILBOX: process.env.AGENT_MAILBOX ?? "",
        TEAMS_CLIENT_STATE: process.env.TEAMS_CLIENT_STATE ?? "",
        GRAPH_API_BASE_URL: (process.env.GRAPH_API_BASE_URL ?? "https://graph.microsoft.com/v1.0").replace(/\/$/, ""),
        GRAPH_LOGIN_BASE_URL: (process.env.GRAPH_LOGIN_BASE_URL ?? "https://login.microsoftonline.com").replace(/\/$/, ""),
    }
};

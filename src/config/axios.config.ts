import axios from "axios";
import { Env } from "./env.config";

export const workableApi = axios.create({
    baseURL: `${Env.workable.WORKABLE_BASE_URL}/spi/v3`,
    timeout: 20_000,
    headers: {
        Authorization: `Bearer ${Env.workable.WORKABLE_AUTH_TOKEN}`,
        Accept: "application/json",
    },
});

export const fileServiceApi = axios.create({
    baseURL: Env.virtualAvatar.VA_FILE_SERVICE_URL,
    timeout: 30_000,
    headers: {
        "X-Bucket-Name": Env.virtualAvatar.VA_FILE_SERVICE_BUCKET,
        "X-API-Key": Env.virtualAvatar.VA_FILE_SERVICE_API_KEY,
        Accept: "*/*",
    },
});

export const anamApi = axios.create({
    baseURL: Env.anam.api_base_url,
    timeout: 20_000,
    headers: {
        Authorization: `Bearer ${Env.anam.anam_api_key}`,
        "Content-Type": "application/json",
    },
});

export const translatorApi = axios.create({
    baseURL: Env.azureAi.AZURE_TRANSLATOR_ENDPOINT,
    timeout: 15_000,
    headers: {
        "Ocp-Apim-Subscription-Key": Env.azureAi.AZURE_AI_SERVICES_KEY,
        "Ocp-Apim-Subscription-Region": Env.azureAi.AZURE_AI_SERVICES_REGION,
        "Content-Type": "application/json",
    },
    paramsSerializer: { indexes: null },
});

export const ttsApi = axios.create({
    baseURL: Env.azureAi.AZURE_TTS_ENDPOINT,
    timeout: 20_000,
    responseType: "arraybuffer",
    headers: {
        "Ocp-Apim-Subscription-Key": Env.azureAi.AZURE_AI_SERVICES_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "agentic-avatar",
    },
});

const TOKEN_SKEW_MS = 120_000;

let graphToken: { value: string; expiresAt: number } | null = null;
let graphTokenInFlight: Promise<string> | null = null;

const fetchGraphToken = async (): Promise<string> => {
    const url = `${Env.teams.GRAPH_LOGIN_BASE_URL}/${Env.teams.TEAMS_TENANT_ID}/oauth2/v2.0/token`;
    const form = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: Env.teams.TEAMS_CLIENT_ID,
        client_secret: Env.teams.TEAMS_CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
    });

    const { data } = await axios.post<{ access_token: string; expires_in: number }>(url, form, {
        timeout: 30_000,
    });

    graphToken = {
        value: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000 - TOKEN_SKEW_MS,
    };
    return graphToken.value;
};

const graphAccessToken = async (): Promise<string> => {
    if (graphToken && Date.now() < graphToken.expiresAt) return graphToken.value;
    if (graphTokenInFlight) return graphTokenInFlight;

    graphTokenInFlight = fetchGraphToken().finally(() => {
        graphTokenInFlight = null;
    });
    return graphTokenInFlight;
};

export const graphApi = axios.create({
    baseURL: Env.teams.GRAPH_API_BASE_URL,
    timeout: 30_000,
    headers: { "Content-Type": "application/json" },
});

graphApi.interceptors.request.use(async (config) => {
    config.headers.set("Authorization", `Bearer ${await graphAccessToken()}`);
    return config;
});

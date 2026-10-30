import { CallLocator, ConnectCallOptions, StartRecordingOptions } from "@azure/communication-call-automation";
import { callAutomationClient } from "../../config/acs.config";
import { Env } from "../../config/env.config";
import { acsCall } from "../../helpers/acs.helper";
import { trace } from "../../helpers/trace.helper";
import { sleep } from "../../helpers/utility.helper";
import { IRoomConnection } from "../../interfaces/IAcs.interface";

const CALLBACK_PATH = "/v1/va/webhooks/call-events";
export const TRANSCRIPTION_PATH = "/v1/va/ws/transcription";

const CONNECT_POLL_ATTEMPTS = 20;
const CONNECT_POLL_INTERVAL_MS = 3_000;
const CONNECT_RETRY_MS = 5_000;

const callbackUrl = (): string => {
    if (!Env.anam.public_base_url) {
        throw new Error("AGENTIC_AVATAR_BASE_URL is not set - a recording would never produce a file");
    }
    return `${Env.anam.public_base_url}${CALLBACK_PATH}?code=${encodeURIComponent(Env.acs.ACS_WEBHOOK_SECRET)}`;
};

/** Recording needs a serverCallId, which only exists once the connection is "connected". */
export const connectToRoom = async (
    roomId: string,
    transcriptionLocale?: string,
    attempts = 1,
): Promise<IRoomConnection> =>
    acsCall("connectToRoom", async () => {
        const locator: CallLocator = { kind: "roomCallLocator", id: roomId };
        const options: ConnectCallOptions =
            transcriptionLocale && Env.azureAi.AZURE_AI_SERVICES_ENDPOINT
                ? {
                      callIntelligenceOptions: { cognitiveServicesEndpoint: Env.azureAi.AZURE_AI_SERVICES_ENDPOINT },
                      transcriptionOptions: {
                          transportType: "websocket",
                          transportUrl: `${Env.anam.public_base_url.replace(/^http/, "ws")}${TRANSCRIPTION_PATH}?code=${encodeURIComponent(Env.acs.ACS_WEBHOOK_SECRET)}`,
                          locale: transcriptionLocale,
                          enableIntermediateResults: true,
                          startTranscription: false,
                      },
                  }
                : {};
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            const { callConnection } = await callAutomationClient.connectCall(locator, callbackUrl(), options);

            for (let poll = 0; poll < CONNECT_POLL_ATTEMPTS; poll += 1) {
                const properties = await callConnection.getCallConnectionProperties().catch((error) => {
                    if (error?.statusCode === 404) return null;
                    throw error;
                });
                if (!properties) break;
                if (properties.callConnectionState === "connected" && properties.serverCallId) {
                    return {
                        callConnectionId: properties.callConnectionId ?? "",
                        serverCallId: properties.serverCallId,
                    };
                }
                if (poll === CONNECT_POLL_ATTEMPTS - 1) {
                    throw new Error(`room ${roomId} never reached the connected state`);
                }
                await sleep(CONNECT_POLL_INTERVAL_MS);
            }

            if (attempt < attempts) {
                trace("meeting-rec", roomId, "connect-retry", { attempt });
                await sleep(CONNECT_RETRY_MS);
            }
        }

        throw new Error(`room ${roomId} has no call in progress to join`);
    });

export const startRecording = async (serverCallId: string): Promise<string> =>
    acsCall("startRecording", async () => {
        const options: StartRecordingOptions = {
            callLocator: { kind: "serverCallLocator", id: serverCallId },
            recordingContent: "audioVideo",
            recordingChannel: "mixed",
            recordingFormat: "mp4",
            recordingStateCallbackEndpointUrl: callbackUrl(),
        };
        const result = await callAutomationClient.getCallRecording().start(options);
        return result.recordingId;
    });

export const stopRecording = async (recordingId: string): Promise<void> => {
    await acsCall("stopRecording", () => callAutomationClient.getCallRecording().stop(recordingId));
};

export const isConnected = async (callConnectionId: string): Promise<boolean> =>
    callAutomationClient
        .getCallConnection(callConnectionId)
        .getCallConnectionProperties()
        .then((properties) => properties.callConnectionState === "connected")
        .catch(() => false);

export const startTranscription = async (callConnectionId: string, locale: string): Promise<void> => {
    await acsCall("startTranscription", () =>
        callAutomationClient.getCallConnection(callConnectionId).getCallMedia().startTranscription({ locale }),
    );
};

export const stopTranscription = async (callConnectionId: string): Promise<void> => {
    await acsCall("stopTranscription", () =>
        callAutomationClient.getCallConnection(callConnectionId).getCallMedia().stopTranscription(),
    );
};

export const updateTranscription = async (callConnectionId: string, locale: string): Promise<void> => {
    await acsCall("updateTranscription", () =>
        callAutomationClient.getCallConnection(callConnectionId).getCallMedia().updateTranscription(locale),
    );
};

export const hangUpConnection = async (callConnectionId: string): Promise<void> => {
    await acsCall("hangUpConnection", () =>
        callAutomationClient.getCallConnection(callConnectionId).hangUp(true),
    );
};
/**
 * From offset to the end of the file, or the whole file when no offset is given.
 *
 * Deliberately no length: the SDK rejects a length with offset 0 because it tests
 * the offset for truthiness, so the caller takes the slice it wants off the front
 * of the stream instead.
 */
export const downloadRecordingStream = async (
    contentLocation: string,
    offset?: number,
): Promise<NodeJS.ReadableStream> =>
    acsCall("downloadRecordingStream", () =>
        callAutomationClient
            .getCallRecording()
            .downloadStreaming(contentLocation, offset === undefined ? {} : { offset }),
    );

export const deleteRecording = async (deleteLocation: string): Promise<void> => {
    await acsCall("deleteRecording", () =>
        callAutomationClient.getCallRecording().delete(deleteLocation),
    );
};

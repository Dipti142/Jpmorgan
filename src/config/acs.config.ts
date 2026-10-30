import { CallAutomationClient } from "@azure/communication-call-automation";
import { ChatClient } from "@azure/communication-chat";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { CommunicationIdentityClient, TokenScope } from "@azure/communication-identity";
import { RoomsClient } from "@azure/communication-rooms";
import { Env } from "./env.config";

export const ACS_SCOPES: TokenScope[] = ["voip", "chat"];

export const identityClient = new CommunicationIdentityClient(Env.acs.ACS_CONNECTION_STRING);
export const roomsClient = new RoomsClient(Env.acs.ACS_CONNECTION_STRING);
export const callAutomationClient = new CallAutomationClient(Env.acs.ACS_CONNECTION_STRING);

export const chatClientFor = (token: string): ChatClient =>
    new ChatClient(Env.acs.ACS_ENDPOINT, new AzureCommunicationTokenCredential(token));

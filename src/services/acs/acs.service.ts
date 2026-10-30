import { CommunicationRoom, RoomParticipantPatch } from "@azure/communication-rooms";
import { ACS_SCOPES, chatClientFor, identityClient, roomsClient } from "../../config/acs.config";
import { acsCall } from "../../helpers/acs.helper";
import { IAcsIdentity, ICreateRoomInput } from "../../interfaces/IAcs.interface";
import { VirtualAvatarAcsRole } from "../../interfaces/IVirtualAvatarSession.interface";

export const createUserAndToken = async (): Promise<IAcsIdentity> =>
    acsCall("createUserAndToken", async () => {
        const result = await identityClient.createUserAndToken(ACS_SCOPES);
        return {
            communicationUserId: result.user.communicationUserId,
            token: result.token,
            expiresOn: result.expiresOn,
        };
    });

export const issueTokenFor = async (communicationUserId: string): Promise<IAcsIdentity> =>
    acsCall("issueTokenFor", async () => {
        const result = await identityClient.getToken({ communicationUserId }, ACS_SCOPES);
        return { communicationUserId, token: result.token, expiresOn: result.expiresOn };
    });

export const createRoom = async (input: ICreateRoomInput): Promise<CommunicationRoom> =>
    acsCall("createRoom", () => {
        const participants: RoomParticipantPatch[] = [
            { id: { communicationUserId: input.ownerCommunicationUserId }, role: "Presenter" },
        ];
        return roomsClient.createRoom({
            validFrom: input.validFrom,
            validUntil: input.validUntil,
            participants,
        });
    });

export const addRoomParticipant = async (
    roomId: string,
    communicationUserId: string,
    role: VirtualAvatarAcsRole,
): Promise<void> => {
    await acsCall("addRoomParticipant", () =>
        roomsClient.addOrUpdateParticipants(roomId, [{ id: { communicationUserId }, role }]),
    );
};

export const removeRoomParticipant = async (
    roomId: string,
    communicationUserId: string,
): Promise<void> => {
    await acsCall("removeRoomParticipant", () =>
        roomsClient.removeParticipants(roomId, [{ communicationUserId }]),
    );
};

export const updateRoomValidUntil = async (
    roomId: string,
    validUntil: Date,
): Promise<CommunicationRoom> =>
    acsCall("updateRoomValidUntil", async () => {
        const room = await roomsClient.getRoom(roomId);
        return roomsClient.updateRoom(roomId, { validFrom: room.validFrom, validUntil });
    });

export const updateRoomWindow = async (
    roomId: string,
    validFrom: Date,
    validUntil: Date,
): Promise<CommunicationRoom> =>
    acsCall("updateRoomWindow", () => roomsClient.updateRoom(roomId, { validFrom, validUntil }));

export const endRoom = async (roomId: string): Promise<void> => {
    await acsCall("endRoom", () => roomsClient.deleteRoom(roomId));
};

export const createChatThread = async (
    ownerToken: string,
    ownerCommunicationUserId: string,
    topic: string,
): Promise<string | null> =>
    acsCall("createChatThread", async () => {
        const result = await chatClientFor(ownerToken).createChatThread(
            { topic },
            {
                participants: [
                    { id: { communicationUserId: ownerCommunicationUserId }, displayName: "Session" },
                ],
            },
        );
        return result.chatThread?.id ?? null;
    });

export const addChatParticipant = async (
    ownerToken: string,
    threadId: string,
    communicationUserId: string,
    displayName: string,
): Promise<void> => {
    await acsCall("addChatParticipant", () =>
        chatClientFor(ownerToken)
            .getChatThreadClient(threadId)
            .addParticipants({ participants: [{ id: { communicationUserId }, displayName }] }),
    );
};

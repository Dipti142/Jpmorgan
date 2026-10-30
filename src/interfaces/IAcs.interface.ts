export interface IAcsIdentity {
    communicationUserId: string;
    token: string;
    expiresOn: Date;
}

export interface ICreateRoomInput {
    validFrom: Date;
    validUntil: Date;
    ownerCommunicationUserId: string;
}

export interface IRoomConnection {
    callConnectionId: string;
    serverCallId: string;
}

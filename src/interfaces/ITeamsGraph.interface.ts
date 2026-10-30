export interface IGraphRecipient {
    emailAddress?: { name?: string; address?: string };
}

export interface IGraphMessage {
    id: string;
    subject?: string;
    from?: IGraphRecipient;
    toRecipients?: IGraphRecipient[];
    ccRecipients?: IGraphRecipient[];
    receivedDateTime?: string;
    body?: { contentType?: string; content?: string };
    bodyPreview?: string;
    hasAttachments?: boolean;
    webLink?: string;
    meetingMessageType?: string;
    event?: IGraphCalendarEvent;
    singleValueExtendedProperties?: { id?: string; value?: string }[];
}

export interface IGraphCalendarEvent {
    id: string;
    iCalUId?: string;
    subject?: string;
    isCancelled?: boolean;
    type?: string;
    seriesMasterId?: string | null;
    webLink?: string;
    start?: { dateTime?: string; timeZone?: string };
    end?: { dateTime?: string; timeZone?: string };
    location?: { displayName?: string };
    organizer?: IGraphRecipient;
    attendees?: (IGraphRecipient & { type?: string; status?: { response?: string } })[];
}

export interface IGraphSubscription {
    id: string;
    resource: string;
    changeType: string;
    notificationUrl: string;
    lifecycleNotificationUrl?: string;
    expirationDateTime: string;
    clientState?: string;
}

export interface IGraphCollection<T> {
    value: T[];
}
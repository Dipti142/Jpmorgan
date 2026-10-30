import axios from "axios";
import { anamApi } from "../config/axios.config";
import {
    IAnamMeetingInvite,
    IAnamMeetingInviteRequest,
    IAnamSessionTokenRequest,
    IAnamSessionTokenResponse,
} from "../interfaces/IAnamMeeting.interface";
import { IAnamRemoteTool, IAnamToolDefinition } from "../interfaces/IAnamTool.interface";

export interface IAnamKnowledgeGroup {
    id: string;
    name: string;
    description?: string;
    documentCount?: number;
}

/** A document is only searchable at READY; FAILED is terminal. */
export interface IAnamKnowledgeDocument {
    id: string;
    filename?: string;
    status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
}

export const createTool = async (definition: IAnamToolDefinition): Promise<{ id: string }> => {
    const { data } = await anamApi.post<{ id: string }>("/tools", definition);
    return data;
};

export const updateTool = async (
    remoteToolId: string,
    definition: IAnamToolDefinition,
): Promise<{ id: string }> => {
    const { data } = await anamApi.put<{ id: string }>(`/tools/${remoteToolId}`, definition);
    return data;
};

export const deleteTool = async (remoteToolId: string): Promise<void> => {
    await anamApi.delete(`/tools/${remoteToolId}`);
};

/** What Anam actually stored, which is not necessarily what was sent. */
export const getTool = async (remoteToolId: string): Promise<Record<string, unknown>> => {
    const { data } = await anamApi.get<Record<string, unknown>>(`/tools/${remoteToolId}`);
    return data;
};

export const listTools = async (): Promise<IAnamRemoteTool[]> => {
    const found = new Map<string, IAnamRemoteTool>();

    for (let page = 1; page <= 50; page += 1) {
        const { data } = await anamApi.get<IAnamRemoteTool[] | { data: IAnamRemoteTool[] }>(
            `/tools?perPage=100&page=${page}`,
        );
        const rows = Array.isArray(data) ? data : (data?.data ?? []);
        if (!rows.length) break;

        const before = found.size;
        for (const tool of rows) found.set(tool.id, tool);
        if (found.size === before) break;
    }

    return [...found.values()];
};

export const findSystemToolId = async (name: string): Promise<string | null> => {
    const tools = await listTools();
    const found = tools.find(
        (tool) => String(tool.type).toUpperCase() === "SYSTEM" && tool.name === name,
    );
    return found?.id ?? null;
};

export const createSessionToken = async (request: IAnamSessionTokenRequest): Promise<string> => {
    const { data } = await anamApi.post<IAnamSessionTokenResponse>("/auth/session-token", request);
    if (!data?.sessionToken) throw new Error("Anam returned no session token");
    return data.sessionToken;
};

export const createMeetingInvite = async (
    request: IAnamMeetingInviteRequest,
): Promise<IAnamMeetingInvite> => {
    const { data } = await anamApi.post<IAnamMeetingInvite>("/meetings/invites", request);
    if (!data?.id) throw new Error("Anam returned no invite id");
    return data;
};

export const cancelMeetingInvite = async (inviteId: string): Promise<IAnamMeetingInvite> => {
    const { data } = await anamApi.delete<IAnamMeetingInvite>(`/meetings/invites/${inviteId}`);
    return data;
};

export const createKnowledgeGroup = async (
    name: string,
    description: string,
): Promise<IAnamKnowledgeGroup> => {
    const { data } = await anamApi.post<IAnamKnowledgeGroup>("/knowledge/groups", { name, description });
    if (!data?.id) throw new Error("Anam returned no knowledge group id");
    return data;
};

export const listKnowledgeGroups = async (): Promise<IAnamKnowledgeGroup[]> => {
    const { data } = await anamApi.get<IAnamKnowledgeGroup[] | { data: IAnamKnowledgeGroup[] }>(
        "/knowledge/groups",
    );
    return Array.isArray(data) ? data : (data?.data ?? []);
};

export const listKnowledgeDocuments = async (groupId: string): Promise<IAnamKnowledgeDocument[]> => {
    const { data } = await anamApi.get<IAnamKnowledgeDocument[] | { data: IAnamKnowledgeDocument[] }>(
        `/knowledge/groups/${groupId}/documents`,
    );
    return Array.isArray(data) ? data : (data?.data ?? []);
};

export const presignKnowledgeUpload = async (
    groupId: string,
    file: { filename: string; contentType: string; fileSize: number },
): Promise<{ uploadUrl: string; documentId: string }> => {
    const { data } = await anamApi.post<{ uploadUrl: string; documentId: string }>(
        `/knowledge/groups/${groupId}/documents/presigned-upload`,
        file,
    );
    if (!data?.uploadUrl || !data?.documentId) throw new Error("Anam returned no presigned upload url");
    return data;
};

/** Object storage, not Anam, so it must not carry the Anam Authorization header. */
export const putKnowledgeFile = async (
    uploadUrl: string,
    body: Buffer,
    contentType: string,
): Promise<void> => {
    await axios.put(uploadUrl, body, { headers: { "Content-Type": contentType } });
};

export const confirmKnowledgeUpload = async (
    documentId: string,
    fileSize: number,
): Promise<IAnamKnowledgeDocument> => {
    const { data } = await anamApi.post<IAnamKnowledgeDocument>(
        `/knowledge/documents/${documentId}/confirm-upload`,
        { fileSize },
    );
    return data;
};

export const getKnowledgeDocument = async (documentId: string): Promise<IAnamKnowledgeDocument> => {
    const { data } = await anamApi.get<IAnamKnowledgeDocument>(`/knowledge/documents/${documentId}`);
    return data;
};

export const deleteKnowledgeDocument = async (documentId: string): Promise<void> => {
    await anamApi.delete(`/knowledge/documents/${documentId}`);
};

export interface IAnamKnowledgePassage {
    documentId: string;
    filename?: string;
    content: string;
    chunkIndex?: number;
    score?: number;
}

export const searchKnowledgeGroup = async (
    groupId: string,
    query: string,
    limit = 5,
): Promise<IAnamKnowledgePassage[]> => {
    const { data } = await anamApi.post<
        IAnamKnowledgePassage[] | { results?: IAnamKnowledgePassage[]; data?: IAnamKnowledgePassage[] }
    >(`/knowledge/groups/${groupId}/search`, { query, limit });

    if (Array.isArray(data)) return data;
    return data?.results ?? data?.data ?? [];
};

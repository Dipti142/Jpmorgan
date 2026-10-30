export type AnamToolType = "CLIENT" | "SERVER_RAG" | "SERVER_WEBHOOK" | "SYSTEM";

export interface IAnamToolProperty {
    type: string;
    description?: string;
    enum?: string[];
    properties?: Record<string, IAnamToolProperty>;
    items?: IAnamToolProperty;
    required?: string[];
}

export interface IAnamToolParameters {
    type: "object";
    properties: Record<string, IAnamToolProperty>;
    required?: string[];
}

export interface IAnamWebhookConfig {
    url: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    awaitResponse?: boolean;
    parameters?: IAnamToolParameters;
}

export interface IAnamToolDefinition {
    type: AnamToolType;
    name: string;
    description: string;
    config?: IAnamWebhookConfig | Record<string, unknown>;
    disableInterruptions?: boolean;
    toolTimeoutSeconds?: number;
}

/** A tool as Anam lists it back. Only the fields provisioning reads. */
export interface IAnamRemoteTool {
    id: string;
    name: string;
    type: AnamToolType;
    description?: string;
}

export interface IToolBlueprint {
    key: string;
    kind: "webhook" | "system" | "knowledge" | "client";
    description: string;
    parameters?: IAnamToolParameters;
    path?: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    awaitResponse?: boolean;
    awaitResult?: boolean;
    toolTimeoutSeconds?: number;
    disableInterruptions?: boolean;
}

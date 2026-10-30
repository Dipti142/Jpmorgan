import { Response } from "express";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { clientLog, dynamoDBClient, EXCLUDED_AGENT_LOG } from "../config/dynamoDB.config";
import { Env } from "../config/env.config";
import { AuthRequest, CustomRequest } from "../types/config/request.type";
import { maskSensitiveData } from "../utils/dynamoDB.utils";
import { formatDateTime, safeJsonStringify, serializeError } from "./utility.helper";
import crypto from "node:crypto";
import { CreateTableCommand, ScalarAttributeType, waitUntilTableExists } from "@aws-sdk/client-dynamodb";

export default class ServerLog {
    public static readonly requestDataEnabled = true;
    public static readonly responseDataEnabled = true;
    private static readonly errorTable = Env.dynamoDB.errorTable;

    private static shouldLog(userAgent: string): boolean {
        return (
            !EXCLUDED_AGENT_LOG.includes(userAgent)
        );
    }

    private static buildCommonLogData(request: AuthRequest, startTime: number, endTime: number) {
        const { headers, method, originalUrl, socket: { remoteAddress } = {} } = request;
        const ipAddress = headers["x-forwarded-for"] ?? remoteAddress;
        const userAgent = headers["user-agent"] ?? "";
        const allowedHeaders = new Set([
            "user-agent",
            "referer",
            "origin", 
            "accept",
            "sec-ch-ua",
            "sec-ch-ua-platform",
            "host",
        ]);
        const filteredAllowedHeaders = Object.fromEntries(
            Object.entries(headers as Record<string, any>)
                .map(([key, value]) => [key.toLowerCase(), value])
                .filter(([key]) => allowedHeaders.has(key))
        );
        const logData = {
            ipAddress,
            userAgent,
            method: method,
            url: originalUrl,
            requestBody: {
                headers: filteredAllowedHeaders,
                body: (this.requestDataEnabled) ? request.body : {},
                params: (this.requestDataEnabled) ? request.params : {},
                query: (this.requestDataEnabled) ? request.query : {},
            },
            rawRequestBody: {
                headers: filteredAllowedHeaders,
                body: (this.requestDataEnabled) ? request.body : {},
                params: (this.requestDataEnabled) ? request.params : {},
                query: (this.requestDataEnabled) ? request.query : {},
            },
            startTime: formatDateTime(new Date(startTime)),
            endTime: formatDateTime(new Date(endTime)),
            executionTime: `${endTime - startTime}ms`,
            userId: request.user?.userID ?? null,
            companyId: request.user?.companyID ?? null,
        };
        return logData;
    }

    static async errorLog(request: CustomRequest, response: Response, error: any, responseData: any = {}, status: number = 500) {
        const endTime = Date.now();
        const startTime = request.startTime ?? endTime;
        const logData = this.buildCommonLogData(request, startTime, endTime);
        const requestedBy = request.user ? (`${request.user.firstName || ''} ${request.user.lastName || ''}`.trim()) : '';
        const customerId = request.params.customerId ?? request.params.customer_id ?? 0;
        const userId = request.headers["x-user-id"] ?? request.headers["X-User-Id"] ?? request.params.userId ?? request.params.user_id ?? 0;
        const tabId = request.headers["x-tab-id"] ?? request.headers["X-Tab-Id"] ?? 0;
        if (!this.shouldLog(logData.userAgent)) return;
        const item = {
            sessionId: crypto.randomUUID(),
            requestedBy,
            authUserId: logData.userId,
            companyId: logData.companyId,
            customerId,
            userId,
            endpoint: logData.url,
            method: logData.method,
            requestBody: JSON.stringify(maskSensitiveData(logData.requestBody)),
            responseBody: this.responseDataEnabled ? safeJsonStringify(maskSensitiveData(responseData)) : null,
            statusCode: status,
            errorData: safeJsonStringify(serializeError(error), 2),
            remoteAddress: logData.ipAddress,
            userAgent: logData.userAgent,
            timestamp: new Date().toISOString(),
            APIVersion: "v1",
            executionTime: logData.executionTime,
            tabId
        };
        await this.putLogToDynamo(this.errorTable, item);
    }

    private static async putLogToDynamo(table: string, item: Record<string, any>) {
        try {
            await clientLog.send(new PutCommand({ TableName: table, Item: item }));
        } catch (err: any) {
            if (err.name === "ResourceNotFoundException") {
                try {
                    const createTableParams = {
                        TableName: table,
                        AttributeDefinitions: [
                            { AttributeName: "sessionId", AttributeType: ScalarAttributeType.S }
                        ],
                        KeySchema: [{ AttributeName: "sessionId", KeyType: "HASH" }],
                        BillingMode: "PAY_PER_REQUEST",
                    };
                    await clientLog.send(new CreateTableCommand(createTableParams as any));
                    await waitUntilTableExists(
                        {
                            client: dynamoDBClient,
                            maxWaitTime: 15,
                            minDelay: 5,
                        },
                        { TableName: table }
                    );
                    await clientLog.send(new PutCommand({ TableName: table, Item: item }));
                } catch (error) {
                    console.error(`DynamoDB table [${table}] creation or insert failed:`, error);
                }
            } else {
                console.error(`DynamoDB put log failed for [${table}]:`, err);
            }
        }
    }
}
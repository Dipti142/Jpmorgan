import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Env } from "./env.config";

const localEndpoint = Env.dynamoDB.localEndpoint;

export const dynamoDBClient = new DynamoDBClient({
  region: Env.awsSdk.AWS_WATCH_REGION,
  ...(localEndpoint && { endpoint: localEndpoint }),
  credentials: localEndpoint
    ? { accessKeyId: "local", secretAccessKey: "local" }
    : {
        accessKeyId: Env.awsSdk.AWS_ACCESS_KEY,
        secretAccessKey: Env.awsSdk.AWS_SECRET_KEY,
      },
});
export const clientLog = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
export const EXCLUDED_AGENT_LOG = ["ELB-HealthChecker/2.0"];

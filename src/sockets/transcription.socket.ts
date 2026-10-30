import { Server as HttpServer } from "node:http";
import { WebSocketServer } from "ws";
import { Env } from "../config/env.config";
import { timingSafeMatch } from "../helpers/security.helper";
import { trace, traceFailure } from "../helpers/trace.helper";
import { TRANSCRIPTION_PATH } from "../services/acs/acsRecording.service";
import { openStream } from "../services/meeting/meetingTranscript.service";

const wss = new WebSocketServer({ noServer: true });

export const attachTranscriptionSocket = (httpServer: HttpServer): void => {
    httpServer.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url ?? "", "http://localhost");
        if (url.pathname !== TRANSCRIPTION_PATH) return;

        if (!timingSafeMatch(url.searchParams.get("code") ?? "", Env.acs.ACS_WEBHOOK_SECRET)) {
            trace("meeting-transcript", "-", "unauthorized", { ip: req.socket.remoteAddress });
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            const stream = openStream();
            ws.on("message", (data) => stream.push(data.toString()));
            ws.on("close", stream.close);
            ws.on("error", (error) => traceFailure("meeting-transcript", "-", "socket", error));
        });
    });
};

export const closeTranscriptionSocket = async (): Promise<void> => {
    wss.clients.forEach((client) => client.terminate());
    await new Promise((resolve) => wss.close(() => resolve(undefined)));
};

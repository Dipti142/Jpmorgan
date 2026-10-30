import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { isAllowedOrigin } from "../helpers/security.helper";

/**
 * The socket.io singleton.
 *
 * Held here rather than in server.ts so a service can emit without importing the
 * server, and so there is one place that knows whether the transport is up.
 *
 * Rooms live in this process. Running more than one replica needs the Redis
 * adapter, or a lobby event reaches only the organisers on the same instance.
 */

let io: Server | null = null;

export const initSocketServer = (httpServer: HttpServer): Server => {
    if (io) return io;

    io = new Server(httpServer, {
        path: "/socket.io",
        cors: {
            origin: (origin, callback) => {
                if (!origin || isAllowedOrigin(origin)) return callback(null, true);
                return callback(new Error("CORS policy: Origin not allowed"));
            },
            methods: ["GET", "POST"],
        },
    });

    return io;
};

export const getSocketServer = (): Server | null => io;

export const closeSocketServer = async (): Promise<void> => {
    if (!io) return;
    await new Promise((resolve) => io!.close(() => resolve(undefined)));
    io = null;
};

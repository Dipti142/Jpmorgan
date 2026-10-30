import { app, webApp } from "./app";
import { Env } from "./config/env.config";
import { closeSocketServer } from "./config/socket.config";
import { listenForShutdown, onShutdown } from "./helpers/shutdown.helper";
import { traceFailure } from "./helpers/trace.helper";
import * as teamsSubscription from "./services/teamsSubscription.service";
import { sweepLobbyTimeouts } from "./services/meeting/meetingJoin.service";
import * as vaSchedule from "./services/meeting/vaSchedule.service";
import { attachTranscriptionSocket, closeTranscriptionSocket } from "./sockets/transcription.socket";
import { attachVirtualAvatarSocket } from "./sockets/virtualAvatar.socket";

const LOBBY_SWEEP_INTERVAL_MS = 60_000;

const start = async (): Promise<void> => {
  try {
    await webApp.prepare();

    const server = app.listen(Env.server_port, () => {
      console.log(`Server is running on port ${Env.server_port}`);
      console.log(`Web app available at http://localhost:${Env.server_port}`);
      console.log(`Swagger Docs available at http://localhost:${Env.server_port}/api-docs`);
      void teamsSubscription.start();
    });

    // Must stay above attachVirtualAvatarSocket or Next's HMR socket takes /socket.io.
    server.on("upgrade", webApp.getUpgradeHandler());
    attachVirtualAvatarSocket(server);
    attachTranscriptionSocket(server);

    const lobbySweep = setInterval(() => {
      void sweepLobbyTimeouts().catch((error) => {
        traceFailure("va", "lobby-sweep", "failed", error);
      });
      void vaSchedule.sweep().catch((error) => {
        traceFailure("va", "schedule-sweep", "failed", error);
      });
    }, LOBBY_SWEEP_INTERVAL_MS);

    onShutdown("lobby-sweep", () => clearInterval(lobbySweep));
    onShutdown("socket", closeSocketServer);
    onShutdown("transcription-socket", closeTranscriptionSocket);
    onShutdown("http", () => new Promise((resolve) => server.close(() => resolve(undefined))));
    onShutdown("mail-subscription", teamsSubscription.stop);
    listenForShutdown();
  } catch (error) {
    console.error("❌ Error starting the app:", error);
    process.exit(1);
  }
};
void start();

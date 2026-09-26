import { config } from "./config";
import { buildApp } from "./app";
import { logger } from "./utils/logger";
import { closeSessionStore } from "./session/sessionStore";

const app = buildApp();

const server = app.listen(config.port, () => {
  logger.info(`SecureCloud bot listening on port ${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await closeSessionStore();
    process.exit(0);
  });
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

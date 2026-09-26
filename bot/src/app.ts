import express, { Express, Request, Response } from "express";
import { rawBodySaver, verifySignature, rateLimit } from "./middleware/security";
import { verifyWebhook, receiveWebhook } from "./controllers/webhookController";
import { checkNextcloudHealth } from "./integrations/nextcloud";
import { logger } from "./utils/logger";

export function buildApp(): Express {
  const app = express();

  app.use(express.json({ limit: "5mb", verify: rawBodySaver }));
  app.use(rateLimit);

  // Meta's GET verification handshake — no signature to check yet.
  app.get("/webhook", verifyWebhook);

  // Incoming messages — must carry a valid HMAC signature from Meta.
  app.post("/webhook", verifySignature, receiveWebhook);

  app.get("/health", async (_req: Request, res: Response) => {
    const nextcloudUp = await checkNextcloudHealth();
    if (nextcloudUp) {
      res.status(200).json({ status: "ok" });
    } else {
      res.status(503).json({ status: "degraded", nextcloud: false });
    }
  });

  app.use((req: Request, res: Response) => {
    res.sendStatus(404);
  });

  // Central error handler — never leak stack traces or secrets to clients.
  app.use((err: any, _req: Request, res: Response, _next: any) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

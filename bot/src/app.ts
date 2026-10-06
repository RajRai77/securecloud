import express, { Express, Request, Response, NextFunction } from "express";
import { rawBodySaver, verifySignature, rateLimit } from "./middleware/security";
import { verifyWebhook, receiveWebhook } from "./controllers/webhookController";
import { checkNextcloudHealth } from "./integrations/nextcloud";
import { logger } from "./utils/logger";
import webApiRouter from "./routes/webApi";

export function buildApp(): Express {
  const app = express();

  // CORS — allow the Vite dev server (and production build) to talk to this API.
  // VITE_FRONTEND_ORIGIN can be set to the Windows dev server origin e.g. http://192.168.1.15:5173
  const allowedOrigins = (process.env.VITE_FRONTEND_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || "";
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  app.use(express.json({ limit: "5mb", verify: rawBodySaver }));
  app.use(rateLimit);

  // Web frontend API — all Nextcloud credentials remain server-side.
  app.use("/api/web", webApiRouter);

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

import { Request, Response, NextFunction } from "express";
import { verifyWebhookSignature } from "../integrations/whatsapp";
import { logger } from "../utils/logger";

/** Captures the raw request body so we can verify Meta's HMAC signature. */
export function rawBodySaver(req: any, _res: Response, buf: Buffer): void {
  if (buf?.length) {
    req.rawBody = buf;
  }
}

export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.header("x-hub-signature-256") || undefined;
  const rawBody = (req as any).rawBody as Buffer | undefined;

  if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
    logger.warn({ ip: req.ip }, "Rejected webhook: invalid signature");
    res.sendStatus(403);
    return;
  }
  next();
}

/** Very small fixed-window in-memory rate limiter per source IP. */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const hits = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || "unknown";
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    res.sendStatus(429);
    return;
  }
  next();
}

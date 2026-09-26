import { Request, Response } from "express";
import { config } from "../config";
import { logger } from "../utils/logger";
import { handleMessage } from "./conversationController";

/** GET /webhook — Meta's one-time webhook verification handshake. */
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
}

/** POST /webhook — incoming message/status notifications from WhatsApp. */
export async function receiveWebhook(req: Request, res: Response): Promise<void> {
  // Acknowledge immediately; Meta expects a fast 200 and will retry on failure/timeout.
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return; // status callbacks (delivered/read) — nothing to do
    }

    for (const message of messages) {
      const from = message.from as string; // WhatsApp user id (phone-based) — isolates sessions
      await routeMessage(from, message);
    }
  } catch (err) {
    logger.error({ err }, "Error processing webhook payload");
  }
}

async function routeMessage(from: string, message: any): Promise<void> {
  switch (message.type) {
    case "text":
      await handleMessage(from, { kind: "text", text: message.text?.body ?? "" });
      return;
    case "interactive": {
      const selection =
        message.interactive?.button_reply?.title ??
        message.interactive?.list_reply?.title ??
        "";
      await handleMessage(from, { kind: "text", text: selection });
      return;
    }
    case "document":
    case "image":
    case "video":
    case "audio": {
      const media = message[message.type];
      await handleMessage(from, {
        kind: "media",
        mediaId: media.id,
        filenameHint: media.filename,
      });
      return;
    }
    default:
      logger.info({ type: message.type }, "Ignoring unsupported message type");
  }
}

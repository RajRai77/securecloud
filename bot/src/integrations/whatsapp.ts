import axios from "axios";
import crypto from "crypto";
import FormData from "form-data";
import { config } from "../config";
import { logger } from "../utils/logger";

const GRAPH_BASE = `https://graph.facebook.com/${config.whatsapp.apiVersion}`;

function client() {
  return axios.create({
    baseURL: GRAPH_BASE,
    headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` },
    timeout: 30000,
  });
}

/** Verifies the X-Hub-Signature-256 header Meta sends on every webhook POST. */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader?: string): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", config.whatsapp.appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function sendTextMessage(to: string, body: string): Promise<void> {
  try {
    await client().post(`/${config.whatsapp.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    });
  } catch (err) {
    logger.error({ err }, "Failed to send WhatsApp text message");
    throw err;
  }
}

interface MediaMeta {
  url: string;
  mime_type: string;
  file_size: number;
}

export async function getMediaMeta(mediaId: string): Promise<MediaMeta> {
  const res = await client().get(`/${mediaId}`);
  return res.data;
}

export async function downloadMedia(mediaUrl: string): Promise<Buffer> {
  const res = await client().get(mediaUrl, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

export async function sendDocument(
  to: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<void> {
  // 1. Upload media to WhatsApp
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", fileBuffer, { filename, contentType: mimeType });

  const uploadRes = await client().post(
    `/${config.whatsapp.phoneNumberId}/media`,
    form,
    { headers: form.getHeaders() }
  );
  const mediaId = uploadRes.data.id;

  // 2. Send the uploaded media as a document message
  await client().post(`/${config.whatsapp.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: { id: mediaId, filename },
  });
}

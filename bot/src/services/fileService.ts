import mime from "mime-types";
import { config } from "../config";
import { logger } from "../utils/logger";
import * as nextcloud from "../integrations/nextcloud";
import * as whatsapp from "../integrations/whatsapp";
import type { FileEntry } from "../session/sessionStore";

export class FileServiceError extends Error {}

const MAX_UPLOAD_BYTES = config.maxUploadMb * 1024 * 1024;
// WhatsApp Cloud API document-download limit is 100MB; keep a safety margin.
const MAX_WHATSAPP_SEND_BYTES = 95 * 1024 * 1024;

export async function handleIncomingMedia(mediaId: string, filenameHint?: string): Promise<FileEntry> {
  const meta = await whatsapp.getMediaMeta(mediaId);
  if (meta.file_size > MAX_UPLOAD_BYTES) {
    throw new FileServiceError(
      `File is too large (limit ${config.maxUploadMb}MB).`
    );
  }
  const buffer = await whatsapp.downloadMedia(meta.url);
  const ext = mime.extension(meta.mime_type) || "bin";
  const filename = filenameHint || `whatsapp_upload_${Date.now()}.${ext}`;
  return nextcloud.uploadFile(buffer, filename);
}

export async function listUserFiles(): Promise<FileEntry[]> {
  return nextcloud.listFiles();
}

export interface DownloadResult {
  buffer: Buffer;
  tooLarge: boolean;
}

export async function fetchFileForDownload(entry: FileEntry): Promise<DownloadResult> {
  if (entry.size > MAX_WHATSAPP_SEND_BYTES) {
    return { buffer: Buffer.alloc(0), tooLarge: true };
  }
  const buffer = await nextcloud.downloadFile(entry);
  return { buffer, tooLarge: false };
}

export async function shareFile(entry: FileEntry) {
  return nextcloud.createShareLink(entry);
}

export async function removeFile(entry: FileEntry): Promise<void> {
  await nextcloud.deleteFile(entry);
}

export async function storageSummary() {
  const info = await nextcloud.getStorageInfo();
  const toGb = (bytes: number | null) =>
    bytes === null ? "∞" : (bytes / 1024 ** 3).toFixed(2);
  const total = info.totalBytes;
  const used = info.usedBytes;
  const free = info.freeBytes ?? (total !== null ? total - used : null);
  return {
    usedGb: toGb(used),
    totalGb: toGb(total),
    availableGb: toGb(free),
  };
}

export function guessMimeType(filename: string): string {
  return mime.lookup(filename) || "application/octet-stream";
}

import { createClient, WebDAVClient, FileStat } from "webdav";
import axios, { AxiosInstance } from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";
import { sanitizeWebdavPath, sanitizeFilename } from "../utils/sanitize";
import type { FileEntry } from "../session/sessionStore";

const ROOT_FOLDER = "SecureCloud"; // all bot-managed files live under this folder in the user's Nextcloud

function webdavClient(): WebDAVClient {
  const url = `${config.nextcloud.baseUrl}/remote.php/dav/files/${config.nextcloud.botUsername}`;
  return createClient(url, {
    username: config.nextcloud.botUsername,
    password: config.nextcloud.botAppPassword,
  });
}

function ocsClient(): AxiosInstance {
  return axios.create({
    baseURL: `${config.nextcloud.baseUrl}/ocs/v2.php`,
    auth: {
      username: config.nextcloud.botUsername,
      password: config.nextcloud.botAppPassword,
    },
    headers: { "OCS-APIRequest": "true", Accept: "application/json" },
    timeout: 30000,
  });
}

async function ensureRootFolder(client: WebDAVClient): Promise<void> {
  const exists = await client.exists(`/${ROOT_FOLDER}`);
  if (!exists) {
    await client.createDirectory(`/${ROOT_FOLDER}`);
  }
}

export async function uploadFile(
  localBuffer: Buffer,
  filename: string
): Promise<FileEntry> {
  const client = webdavClient();
  await ensureRootFolder(client);
  const safeName = sanitizeFilename(filename);
  const remotePath = `/${ROOT_FOLDER}/${safeName}`;
  await client.putFileContents(remotePath, localBuffer, { overwrite: true });
  logger.info({ file: safeName }, "Uploaded file to Nextcloud");
  return { filename: safeName, path: remotePath, size: localBuffer.length, isFolder: false };
}

export async function listFiles(): Promise<FileEntry[]> {
  const client = webdavClient();
  await ensureRootFolder(client);
  const contents = (await client.getDirectoryContents(`/${ROOT_FOLDER}`)) as FileStat[];
  return contents
    .filter((item) => item.type === "file")
    .map((item) => ({
      filename: item.basename,
      path: item.filename, // already a full, server-provided WebDAV path — trusted
      size: item.size,
      isFolder: false,
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export async function downloadFile(entry: FileEntry): Promise<Buffer> {
  const client = webdavClient();
  // entry.path is a full WebDAV server path; extract just the relative portion
  // by using the filename to reconstruct the path relative to the client root.
  const safeName = sanitizeFilename(entry.filename);
  const data = await client.getFileContents(`/${ROOT_FOLDER}/${safeName}`);
  return Buffer.from(data as ArrayBuffer);
}

export async function deleteFile(entry: FileEntry): Promise<void> {
  const client = webdavClient();
  // Reconstruct the path from the filename to avoid double-path issues.
  const safeName = sanitizeFilename(entry.filename);
  await client.deleteFile(`/${ROOT_FOLDER}/${safeName}`);
  logger.info({ file: entry.filename }, "Deleted file from Nextcloud");
}

export interface ShareResult {
  url: string;
  password?: string;
  expireDate?: string;
}

function generateSharePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Creates a real public share link via the Nextcloud OCS Share API. */
export async function createShareLink(entry: FileEntry): Promise<ShareResult> {
  const client = ocsClient();
  // OCS Share API expects the path relative to the Nextcloud user's home directory,
  // e.g. /SecureCloud/filename.pdf — NOT the full WebDAV URL path.
  const safeName = sanitizeFilename(entry.filename);
  const ocsPath = `/${ROOT_FOLDER}/${safeName}`;

  const password = config.nextcloud.sharePasswordDefaultEnabled
    ? generateSharePassword()
    : undefined;

  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + config.nextcloud.shareExpiryDays);
  const expireDateStr = expireDate.toISOString().split("T")[0];

  const params = new URLSearchParams({
    path: ocsPath,
    shareType: "3", // public link
    permissions: "1", // read-only
    expireDate: expireDateStr,
  });
  if (password) params.set("password", password);

  const response = await client.post(
    `/apps/files_sharing/api/v1/shares?format=json`,
    params,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const shareUrl = response.data?.ocs?.data?.url;
  if (!shareUrl) {
    logger.error({ ocsResponse: response.data }, "Nextcloud OCS share response missing URL");
    throw new Error("Nextcloud did not return a share URL");
  }

  return { url: shareUrl, password, expireDate: expireDateStr };
}

export interface StorageInfo {
  usedBytes: number;
  totalBytes: number | null; // null means "unlimited" quota
  freeBytes: number | null;
}

/** Reads real quota info from Nextcloud's user provisioning API. */
export async function getStorageInfo(): Promise<StorageInfo> {
  const client = ocsClient();
  const response = await client.get(
    `/cloud/users/${config.nextcloud.botUsername}?format=json`
  );
  const quota = response.data?.ocs?.data?.quota;
  if (!quota) {
    throw new Error("Could not read storage quota from Nextcloud");
  }
  return {
    usedBytes: quota.used ?? 0,
    totalBytes: quota.total && quota.total > 0 ? quota.total : null,
    freeBytes: quota.free && quota.free > 0 ? quota.free : null,
  };
}

export async function checkNextcloudHealth(): Promise<boolean> {
  try {
    const res = await axios.get(`${config.nextcloud.baseUrl}/status.php`, { timeout: 5000 });
    return res.status === 200 && res.data?.installed === true;
  } catch (err) {
    logger.warn({ err }, "Nextcloud health check failed");
    return false;
  }
}

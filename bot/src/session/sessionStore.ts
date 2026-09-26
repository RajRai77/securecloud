import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../utils/logger";

export type BotStage =
  | "MAIN_MENU"
  | "AWAITING_FILE_SELECTION"
  | "AWAITING_FILE_ACTION"
  | "AWAITING_DELETE_CONFIRM";

export interface FileEntry {
  filename: string; // display name, resolved server-side
  path: string; // WebDAV-relative path, resolved server-side — never built from user input
  size: number;
  isFolder: boolean;
}

export interface SessionState {
  stage: BotStage;
  fileList?: FileEntry[]; // the last listing shown to this user, used to resolve numeric selections
  selectedFile?: FileEntry;
  updatedAt: number;
}

const redis = new Redis(config.redis.url, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => logger.error({ err }, "Redis connection error"));

/**
 * Sessions are strictly isolated per WhatsApp user id (their phone-number
 * based wa_id). Every read/write is scoped by that key so concurrent users
 * can never see or mutate each other's state.
 */
function keyFor(userId: string): string {
  return `securecloud:session:${userId}`;
}

export async function getSession(userId: string): Promise<SessionState> {
  const raw = await redis.get(keyFor(userId));
  if (!raw) {
    return { stage: "MAIN_MENU", updatedAt: Date.now() };
  }
  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    return { stage: "MAIN_MENU", updatedAt: Date.now() };
  }
}

export async function setSession(userId: string, state: SessionState): Promise<void> {
  state.updatedAt = Date.now();
  await redis.set(
    keyFor(userId),
    JSON.stringify(state),
    "EX",
    config.sessionTtlSeconds
  );
}

export async function resetSession(userId: string): Promise<void> {
  await setSession(userId, { stage: "MAIN_MENU", updatedAt: Date.now() });
}

export async function closeSessionStore(): Promise<void> {
  await redis.quit();
}

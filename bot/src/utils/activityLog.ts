/**
 * SecureCloud Activity Log
 *
 * Lightweight server-side audit log for important file operations.
 * Stored in-memory (ring buffer, capped at MAX_ENTRIES) plus optionally
 * persisted to a JSON file in the tmp directory.
 *
 * Actions logged: LOGIN, UPLOAD, DOWNLOAD, DELETE, CREATE_SHARE, DELETE_SHARE
 *
 * What is NEVER logged:
 *   - passwords
 *   - access tokens
 *   - database credentials
 *   - private file contents
 *   - bearer tokens
 */

import fs from "fs";
import path from "path";
import { logger } from "./logger";

export interface ActivityEntry {
  id: number;
  timestamp: string;
  action: string;
  filename: string;
  result: "success" | "failure";
}

const MAX_ENTRIES = 500;
const LOG_FILE = path.join(process.cwd(), "tmp", "activity.json");

let _entries: ActivityEntry[] = [];
let _nextId = 1;
let _loaded = false;

/** Load persisted entries from disk (called once on first access). */
function loadFromDisk(): void {
  if (_loaded) return;
  _loaded = true;
  try {
    if (fs.existsSync(LOG_FILE)) {
      const raw = fs.readFileSync(LOG_FILE, "utf-8");
      const parsed = JSON.parse(raw) as ActivityEntry[];
      if (Array.isArray(parsed)) {
        _entries = parsed.slice(-MAX_ENTRIES);
        _nextId = (_entries[_entries.length - 1]?.id ?? 0) + 1;
      }
    }
  } catch (err) {
    logger.warn({ err }, "activityLog: failed to load from disk (starting fresh)");
    _entries = [];
    _nextId = 1;
  }
}

/** Persist entries to disk (fire-and-forget). */
function saveToDisk(): void {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOG_FILE, JSON.stringify(_entries, null, 2), "utf-8");
  } catch (err) {
    logger.warn({ err }, "activityLog: failed to save to disk");
  }
}

/**
 * Record an activity entry.
 * @param action  One of: LOGIN, UPLOAD, DOWNLOAD, DELETE, CREATE_SHARE, DELETE_SHARE
 * @param filename  Sanitized filename or resource identifier (no secrets)
 * @param result  "success" or "failure"
 */
export function logActivity(
  action: string,
  filename: string,
  result: "success" | "failure" = "success"
): void {
  loadFromDisk();
  const entry: ActivityEntry = {
    id: _nextId++,
    timestamp: new Date().toISOString(),
    action,
    filename,
    result,
  };
  _entries.push(entry);
  // Cap ring buffer
  if (_entries.length > MAX_ENTRIES) {
    _entries = _entries.slice(_entries.length - MAX_ENTRIES);
  }
  saveToDisk();
}

/** Return all activity entries (newest first). */
export function getActivity(): ActivityEntry[] {
  loadFromDisk();
  return [..._entries].reverse();
}

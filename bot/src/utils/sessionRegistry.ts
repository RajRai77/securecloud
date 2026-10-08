/**
 * SecureCloud — Server-Side Session Registry
 *
 * Lightweight in-memory store for active browser sessions.
 * Each open tab/window sends a heartbeat every HEARTBEAT_MS.
 * Sessions that haven't sent a heartbeat within SESSION_TTL_MS are purged.
 *
 * This enables real cross-browser, cross-origin active session tracking
 * without a database or Redis.
 *
 * No passwords, tokens, or file contents are ever stored here.
 */

export interface SessionEntry {
  id: string;        // unique per tab (generated on frontend, stored in sessionStorage)
  browser: string;   // detected user-agent string (e.g. "Chrome on Windows")
  os: string;
  startedAt: string; // ISO timestamp of first registration
  lastSeen: string;  // ISO timestamp of most recent heartbeat
}

/** Sessions older than this (no heartbeat) are considered closed. */
const SESSION_TTL_MS = 12000; // 12 seconds (heartbeat is every 4s, generous margin)

const _sessions = new Map<string, SessionEntry>();

/** Purge sessions that haven't sent a heartbeat recently. */
function purgeStale(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of _sessions.entries()) {
    if (new Date(s.lastSeen).getTime() < cutoff) {
      _sessions.delete(id);
    }
  }
}

/**
 * Register or update a session heartbeat.
 * Called by each browser tab every few seconds.
 */
export function upsertSession(data: Omit<SessionEntry, "lastSeen">): SessionEntry {
  purgeStale();
  const entry: SessionEntry = {
    ...data,
    lastSeen: new Date().toISOString(),
  };
  // Preserve original startedAt if session already exists
  const existing = _sessions.get(data.id);
  if (existing) {
    entry.startedAt = existing.startedAt;
  }
  _sessions.set(data.id, entry);
  return entry;
}

/** Return all currently active sessions (purges stale first). */
export function getSessions(): SessionEntry[] {
  purgeStale();
  return [..._sessions.values()].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
}

/** Revoke a specific session by ID. */
export function revokeSession(id: string): boolean {
  return _sessions.delete(id);
}

/** Revoke all active sessions. */
export function revokeAllSessions(): void {
  _sessions.clear();
}

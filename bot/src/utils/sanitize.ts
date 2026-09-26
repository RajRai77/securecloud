/**
 * Security-critical helpers. The bot must NEVER trust a filename or path
 * that originated from user input (WhatsApp messages) when building a
 * filesystem or WebDAV path. Always resolve user selections against a
 * server-side list (session state) rather than concatenating raw strings.
 */

const SAFE_FILENAME_RE = /^[a-zA-Z0-9._\- ()\[\]]+$/;

/** Strip directory components and reject traversal sequences. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/\.\./g, "").trim();
  if (!cleaned || cleaned.length > 255) {
    throw new Error("Invalid filename");
  }
  return cleaned;
}

/** Validate a filename against an allow-list of safe characters. */
export function isSafeFilename(name: string): boolean {
  return SAFE_FILENAME_RE.test(name) && !name.includes("..");
}

/** Ensure a WebDAV-relative path never escapes the user's root folder. */
export function sanitizeWebdavPath(path: string): string {
  const parts = path
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== "." && p !== "..");
  return parts.map(sanitizeFilename).join("/");
}

/** Parse a numeric menu selection safely (returns null if invalid). */
export function parseSelection(input: string, max: number): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (n < 1 || n > max) return null;
  return n;
}

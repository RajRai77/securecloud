/**
 * SecureCloud Web API Router
 * Thin REST layer on top of the existing Nextcloud integration.
 * All credentials remain server-side. The browser never sees secrets.
 */

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import * as nextcloud from "../integrations/nextcloud";
import { sanitizeFilename } from "../utils/sanitize";
import { logger } from "../utils/logger";
import { logActivity, getActivity } from "../utils/activityLog";
import { upsertSession, getSessions, revokeSession, revokeAllSessions } from "../utils/sessionRegistry";
import { config } from "../config";

const router = Router();

// Multer — in-memory storage, max size from env (default 90 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

// ─── Auth middleware ─────────────────────────────────────────────────────────
// Simple session token approach: the frontend exchanges the admin password
// for a short-lived session token (stored in memory/Redis).
// For the demo we use a header-based bearer token derived from env.
// NEVER send the raw password to the browser.

const WEB_TOKEN = process.env.SECURECLOUD_WEB_TOKEN || "changeme_web_token";

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== WEB_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ─── Login ───────────────────────────────────────────────────────────────────
router.post("/login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (!password) {
    res.status(400).json({ error: "Password required" });
    return;
  }
  if (password !== WEB_TOKEN) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  logActivity("LOGIN", "user", "success");
  res.json({ token: WEB_TOKEN });
});

// ─── Health (public) ─────────────────────────────────────────────────────────
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const up = await nextcloud.checkNextcloudHealth();
    if (up) {
      res.json({
        status: "online",
        nextcloud: true,
        server: "Kali Linux",
        checkedAt: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "degraded",
        nextcloud: false,
        checkedAt: new Date().toISOString(),
      });
    }
  } catch {
    res.status(503).json({
      status: "offline",
      nextcloud: false,
      checkedAt: new Date().toISOString(),
    });
  }
});

// ─── Files ───────────────────────────────────────────────────────────────────
router.get("/files", requireAuth, async (_req: Request, res: Response) => {
  try {
    const files = await nextcloud.listFiles();
    res.json({ files });
  } catch (err) {
    logger.error({ err }, "webApi: listFiles failed");
    res.status(500).json({ error: "Failed to list files" });
  }
});

router.post(
  "/files/upload",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    try {
      const safeName = sanitizeFilename(req.file.originalname);
      const entry = await nextcloud.uploadFile(req.file.buffer, safeName);
      logActivity("UPLOAD", safeName, "success");
      res.json({ file: entry });
    } catch (err: any) {
      logActivity("UPLOAD", req.file.originalname, "failure");
      logger.error({ err }, "webApi: upload failed");
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  }
);

router.get("/files/download/:filename", requireAuth, async (req: Request, res: Response) => {
  try {
    const safeName = sanitizeFilename(req.params.filename);
    const entry = { filename: safeName, path: `/SecureCloud/${safeName}`, size: 0, isFolder: false };
    const buffer = await nextcloud.downloadFile(entry);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
    logActivity("DOWNLOAD", safeName, "success");
  } catch (err) {
    logActivity("DOWNLOAD", req.params.filename, "failure");
    logger.error({ err }, "webApi: download failed");
    res.status(500).json({ error: "Download failed" });
  }
});

router.delete("/files/:filename", requireAuth, async (req: Request, res: Response) => {
  try {
    const safeName = sanitizeFilename(req.params.filename);
    const entry = { filename: safeName, path: `/SecureCloud/${safeName}`, size: 0, isFolder: false };
    await nextcloud.deleteFile(entry);
    logActivity("DELETE", safeName, "success");
    res.json({ success: true });
  } catch (err) {
    logActivity("DELETE", req.params.filename, "failure");
    logger.error({ err }, "webApi: delete failed");
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── Share ───────────────────────────────────────────────────────────────────
router.post("/shares", requireAuth, async (req: Request, res: Response) => {
  const { filename, password, expiryDays } = req.body as {
    filename?: string;
    password?: boolean;
    expiryDays?: number;
  };
  if (!filename) {
    res.status(400).json({ error: "filename required" });
    return;
  }
  try {
    const safeName = sanitizeFilename(filename);
    const entry = { filename: safeName, path: `/SecureCloud/${safeName}`, size: 0, isFolder: false };

    // Temporarily override config for per-request customisation
    const originalDays = config.nextcloud.shareExpiryDays;
    const originalPwd = config.nextcloud.sharePasswordDefaultEnabled;
    (config.nextcloud as any).shareExpiryDays = expiryDays ?? originalDays;
    (config.nextcloud as any).sharePasswordDefaultEnabled = password ?? originalPwd;

    const result = await nextcloud.createShareLink(entry);

    (config.nextcloud as any).shareExpiryDays = originalDays;
    (config.nextcloud as any).sharePasswordDefaultEnabled = originalPwd;

    logActivity("CREATE_SHARE", safeName, "success");
    res.json({ share: result });
  } catch (err: any) {
    logActivity("CREATE_SHARE", req.body.filename, "failure");
    logger.error({ err }, "webApi: createShareLink failed");
    res.status(500).json({ error: err.message || "Share failed" });
  }
});

router.get("/shares", requireAuth, async (_req: Request, res: Response) => {
  // List public shares via Nextcloud OCS API
  try {
    const axios = (await import("axios")).default;
    const ncBase = config.nextcloud.baseUrl;
    const auth = {
      username: config.nextcloud.botUsername,
      password: config.nextcloud.botAppPassword,
    };
    const resp = await axios.get(
      `${ncBase}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json`,
      { auth, headers: { "OCS-APIRequest": "true" }, timeout: 10000 }
    );
    const shares = resp.data?.ocs?.data ?? [];
    res.json({ shares });
  } catch (err) {
    logger.error({ err }, "webApi: listShares failed");
    res.status(500).json({ error: "Failed to list shares" });
  }
});

router.delete("/shares/:shareId", requireAuth, async (req: Request, res: Response) => {
  try {
    const shareId = parseInt(req.params.shareId, 10);
    if (isNaN(shareId)) {
      res.status(400).json({ error: "Invalid share ID" });
      return;
    }
    const axios = (await import("axios")).default;
    const ncBase = config.nextcloud.baseUrl;
    const auth = {
      username: config.nextcloud.botUsername,
      password: config.nextcloud.botAppPassword,
    };
    await axios.delete(
      `${ncBase}/ocs/v2.php/apps/files_sharing/api/v1/shares/${shareId}?format=json`,
      { auth, headers: { "OCS-APIRequest": "true" }, timeout: 10000 }
    );
    logActivity("DELETE_SHARE", `Share ID ${shareId}`, "success");
    res.json({ success: true });
  } catch (err) {
    logActivity("DELETE_SHARE", `Share ID ${req.params.shareId}`, "failure");
    logger.error({ err }, "webApi: deleteShare failed");
    res.status(500).json({ error: "Failed to delete share" });
  }
});

// ─── Storage ─────────────────────────────────────────────────────────────────
router.get("/storage", requireAuth, async (_req: Request, res: Response) => {
  try {
    const info = await nextcloud.getStorageInfo();
    res.json({ storage: info });
  } catch (err) {
    logger.error({ err }, "webApi: getStorage failed");
    res.status(500).json({ error: "Failed to get storage info" });
  }
});

// ─── Activity ─────────────────────────────────────────────────────────────────
router.get("/activity", requireAuth, async (_req: Request, res: Response) => {
  try {
    const activity = getActivity();
    res.json({ activity });
  } catch (err) {
    logger.error({ err }, "webApi: getActivity failed");
    res.status(500).json({ error: "Failed to get activity log" });
  }
});

// ─── Security — Session Registry ─────────────────────────────────────────────
// POST /security/sessions/heartbeat  — register or refresh a browser session
router.post("/security/sessions/heartbeat", requireAuth, (req: Request, res: Response) => {
  const { id, browser, os, startedAt } = req.body as {
    id?: string; browser?: string; os?: string; startedAt?: string;
  };
  if (!id) { res.status(400).json({ error: "id required" }); return; }
  const session = upsertSession({
    id,
    browser: browser || "Unknown Browser",
    os: os || "Unknown OS",
    startedAt: startedAt || new Date().toISOString(),
  });
  res.json({ session });
});

// GET /security/sessions  — list all active sessions
router.get("/security/sessions", requireAuth, (_req: Request, res: Response) => {
  res.json({ sessions: getSessions() });
});

// DELETE /security/sessions/all  — revoke every active session
router.delete("/security/sessions/all", requireAuth, (_req: Request, res: Response) => {
  revokeAllSessions();
  res.json({ success: true });
});

// DELETE /security/sessions/:id  — revoke one session by ID
router.delete("/security/sessions/:id", requireAuth, (req: Request, res: Response) => {
  const removed = revokeSession(req.params.id);
  res.json({ success: removed });
});

export default router;

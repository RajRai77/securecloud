import { logger } from "../utils/logger";
import { parseSelection } from "../utils/sanitize";
import * as session from "../session/sessionStore";
import * as fileService from "../services/fileService";
import * as whatsapp from "../integrations/whatsapp";
import * as menu from "../services/menu";
import { FileServiceError } from "../services/fileService";

type IncomingText = { kind: "text"; text: string };
type IncomingMedia = { kind: "media"; mediaId: string; filenameHint?: string };
export type IncomingMessage = IncomingText | IncomingMedia;

async function reply(to: string, text: string): Promise<void> {
  await whatsapp.sendTextMessage(to, text);
}

export async function handleMessage(userId: string, msg: IncomingMessage): Promise<void> {
  // --- Allowlist check (set ALLOWED_WHATSAPP_NUMBERS to restrict access) ---
  const allowedRaw = process.env.ALLOWED_WHATSAPP_NUMBERS;
  if (allowedRaw && allowedRaw.trim() !== "") {
    const allowed = allowedRaw.split(",").map((n) => n.trim()).filter(Boolean);
    if (!allowed.includes(userId)) {
      logger.warn({ userId }, "Rejected message from unlisted WhatsApp number");
      return; // silently ignore — do NOT reply, to avoid confirming existence of the bot
    }
  }

  // A file sent at any point is treated as an upload request — this matches
  // the natural WhatsApp UX ("just send the file") described in the spec.
  if (msg.kind === "media") {
    await handleUpload(userId, msg.mediaId, msg.filenameHint);
    return;
  }

  const text = msg.text.trim();
  const state = await session.getSession(userId);

  try {
    switch (state.stage) {
      case "MAIN_MENU":
        await handleMainMenu(userId, text);
        break;
      case "AWAITING_FILE_SELECTION":
        await handleFileSelection(userId, text, state);
        break;
      case "AWAITING_FILE_ACTION":
        await handleFileAction(userId, text, state);
        break;
      case "AWAITING_DELETE_CONFIRM":
        await handleDeleteConfirm(userId, text, state);
        break;
      default:
        await session.resetSession(userId);
        await reply(userId, menu.welcomeMessage());
    }
  } catch (err) {
    logger.error({ err, userId }, "Error handling message");
    if (err instanceof FileServiceError) {
      await reply(userId, `❌ ${err.message}`);
    } else {
      await reply(userId, menu.genericErrorMessage());
    }
    await session.resetSession(userId);
  }
}

async function handleMainMenu(userId: string, text: string): Promise<void> {
  const normalized = text.toLowerCase();

  if (["hi", "hello", "hey", "menu", "start"].includes(normalized)) {
    await reply(userId, menu.welcomeMessage());
    return;
  }

  switch (text) {
    case "1": // Upload — informational only, actual upload happens on file receipt
      await reply(userId, "📎 Send me the file you'd like to upload.");
      return;
    case "2":
    case "my files":
      await showFileList(userId, "AWAITING_FILE_SELECTION");
      return;
    case "3": // Download — same flow as "My Files" then Download action
    case "download file":
      await showFileList(userId, "AWAITING_FILE_SELECTION");
      return;
    case "4":
    case "share file":
      await showFileList(userId, "AWAITING_FILE_SELECTION");
      return;
    case "5":
    case "delete file":
      await showFileList(userId, "AWAITING_FILE_SELECTION");
      return;
    case "6":
    case "storage":
    case "storage info":
      await handleStorageInfo(userId);
      return;
    default:
      await reply(userId, menu.unknownCommandMessage());
  }
}

async function showFileList(userId: string, nextStage: session.BotStage): Promise<void> {
  const files = await fileService.listUserFiles();
  await session.setSession(userId, { stage: nextStage, fileList: files, updatedAt: Date.now() });
  await reply(userId, menu.fileListMessage(files));
}

async function handleFileSelection(
  userId: string,
  text: string,
  state: session.SessionState
): Promise<void> {
  const files = state.fileList ?? [];
  const selection = parseSelection(text, files.length);
  if (selection === null) {
    await reply(userId, "Please reply with a valid file number, or type *menu* to start over.");
    return;
  }
  // Selection is resolved strictly against server-side session state —
  // never against a user-supplied filename or path.
  const selected = files[selection - 1];
  await session.setSession(userId, {
    stage: "AWAITING_FILE_ACTION",
    fileList: files,
    selectedFile: selected,
    updatedAt: Date.now(),
  });
  await reply(userId, menu.fileActionMenu(selected));
}

async function handleFileAction(
  userId: string,
  text: string,
  state: session.SessionState
): Promise<void> {
  const file = state.selectedFile;
  if (!file) {
    await session.resetSession(userId);
    await reply(userId, menu.welcomeMessage());
    return;
  }

  switch (text) {
    case "1": // Download
      await handleDownload(userId, file);
      await session.resetSession(userId);
      return;
    case "2": // Share
      await handleShare(userId, file);
      await session.resetSession(userId);
      return;
    case "3": // Delete
      await session.setSession(userId, { ...state, stage: "AWAITING_DELETE_CONFIRM" });
      await reply(userId, menu.deleteConfirmMessage(file.filename));
      return;
    case "4": // Back
      await showFileList(userId, "AWAITING_FILE_SELECTION");
      return;
    default:
      await reply(userId, "Please reply with 1, 2, 3, or 4.");
  }
}

async function handleDeleteConfirm(
  userId: string,
  text: string,
  state: session.SessionState
): Promise<void> {
  const file = state.selectedFile;
  if (!file) {
    await session.resetSession(userId);
    return;
  }
  if (text.trim().toUpperCase() === "YES") {
    await fileService.removeFile(file);
    await reply(userId, menu.deleteSuccessMessage(file.filename));
  } else {
    await reply(userId, "Deletion cancelled.");
  }
  await session.resetSession(userId);
}

async function handleUpload(userId: string, mediaId: string, filenameHint?: string): Promise<void> {
  const uploaded = await fileService.handleIncomingMedia(mediaId, filenameHint);
  await reply(userId, menu.uploadSuccessMessage(uploaded.filename));
  await session.resetSession(userId);
}

async function handleDownload(userId: string, file: session.FileEntry): Promise<void> {
  const result = await fileService.fetchFileForDownload(file);
  if (result.tooLarge) {
    await reply(userId, menu.fileTooLargeMessage(file.filename));
    return;
  }
  const mimeType = fileService.guessMimeType(file.filename);
  await whatsapp.sendDocument(userId, result.buffer, file.filename, mimeType);
}

async function handleShare(userId: string, file: session.FileEntry): Promise<void> {
  const share = await fileService.shareFile(file);
  await reply(userId, menu.shareMessage(file.filename, share.url, share.password, share.expireDate));
}

async function handleStorageInfo(userId: string): Promise<void> {
  const summary = await fileService.storageSummary();
  await reply(userId, menu.storageInfoMessage(summary.usedGb, summary.totalGb, summary.availableGb));
}

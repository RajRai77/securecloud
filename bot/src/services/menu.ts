import type { FileEntry } from "../session/sessionStore";

export function welcomeMessage(): string {
  return (
    "☁️ *Welcome to SecureCloud*\n\n" +
    "Your private cloud storage assistant.\n\n" +
    "1️⃣ Upload File (just send it here)\n" +
    "2️⃣ My Files\n" +
    "3️⃣ Download File\n" +
    "4️⃣ Share File\n" +
    "5️⃣ Delete File\n" +
    "6️⃣ Storage Info\n\n" +
    "Reply with a number."
  );
}

export function fileListMessage(files: FileEntry[]): string {
  if (files.length === 0) {
    return "☁️ Your SecureCloud is empty.\n\nSend me a file to upload it.";
  }
  const numbers = "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟";
  const lines = files
    .slice(0, 10)
    .map((f, i) => `${numbers[i] ?? `${i + 1}.`} ${f.filename}`);
  return `☁️ *Your Files*\n\n${lines.join("\n")}\n\nReply with the number.`;
}

export function fileActionMenu(file: FileEntry): string {
  return (
    `📄 *${file.filename}*\n\n` +
    "Choose an action:\n\n" +
    "1️⃣ Download\n" +
    "2️⃣ Share\n" +
    "3️⃣ Delete\n" +
    "4️⃣ Back"
  );
}

export function uploadSuccessMessage(filename: string): string {
  return `✅ Upload successful.\n\n${filename}\n\nStored securely in your SecureCloud.`;
}

export function shareMessage(filename: string, url: string, password?: string, expires?: string): string {
  let msg = `🔐 *Secure Share Link*\n\nFile:\n${filename}\n\nLink:\n${url}`;
  if (password) msg += `\n\nPassword:\n${password}`;
  if (expires) msg += `\n\nExpires:\n${expires}`;
  return msg;
}

export function deleteConfirmMessage(filename: string): string {
  return `⚠️ *Confirm deletion*\n\n${filename}\n\nReply:\nYES`;
}

export function deleteSuccessMessage(filename: string): string {
  return `🗑️ Deleted.\n\n${filename} has been permanently removed from SecureCloud.`;
}

export function storageInfoMessage(usedGb: string, totalGb: string, availableGb: string): string {
  return (
    "☁️ *SecureCloud Storage*\n\n" +
    `Used: ${usedGb} GB\n` +
    `Available: ${availableGb} GB\n` +
    `Total: ${totalGb} GB`
  );
}

export function genericErrorMessage(): string {
  return "❌ I couldn't access SecureCloud right now.\n\nPlease try again in a moment.";
}

export function fileTooLargeMessage(filename: string): string {
  return (
    `⚠️ *${filename}* is too large to send directly over WhatsApp.\n\n` +
    "I can generate a secure share link instead — reply *4* from the main menu " +
    "and select this file to get one."
  );
}

export function unknownCommandMessage(): string {
  return "🤔 I didn't understand that.\n\n" + welcomeMessage();
}

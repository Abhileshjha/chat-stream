import path from "path";
import fs from "fs";

// All uploaded template media lives under here, organized as
// uploads/{userId}/{phoneNumberId}/{file} so media for different accounts and
// different connected numbers never collide and stay easy to reason about -
// each connected WhatsApp number's header images/documents live in their own
// folder, sticky to whichever templates reference them.
export const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export function sanitizeFolderSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned || "unknown";
}

// Where a newly uploaded file for this user/phone-number should be written.
export function getAccountUploadDir(userId: string, phoneNumberId?: string | null): string {
  const segments = [sanitizeFolderSegment(userId), sanitizeFolderSegment(phoneNumberId || "no-number")];
  const dir = path.join(uploadDir, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Resolves a "/uploads/..." URL (as stored on a template's header component)
// back to an absolute local path, refusing to resolve outside uploadDir even
// if the stored value has been tampered with.
export function resolveUploadedFilePath(mediaUrl: string): string | null {
  if (!mediaUrl.startsWith("/uploads/")) return null;
  const relative = mediaUrl.slice("/uploads/".length);
  const resolved = path.resolve(uploadDir, relative);
  const resolvedUploadDir = path.resolve(uploadDir);
  if (resolved !== resolvedUploadDir && !resolved.startsWith(resolvedUploadDir + path.sep)) {
    return null;
  }
  return resolved;
}

// Converts an absolute path under uploadDir back into the "/uploads/..." URL
// clients and Meta-submission code use, with forward slashes on every OS.
export function toUploadUrl(absolutePath: string): string {
  const relative = path.relative(uploadDir, absolutePath).split(path.sep).join("/");
  return `/uploads/${relative}`;
}

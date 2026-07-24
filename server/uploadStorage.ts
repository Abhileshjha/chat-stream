import { storage } from "./storage";

// Header media (template samples and per-send attachments) is stored in the
// database (see the `uploadedFiles` table), not local disk - Render (and
// most hosts without a paid persistent-disk add-on) wipes local disk on
// every restart, redeploy, or crash recovery. That was silently deleting
// template header images and per-notification attachments, breaking resumed
// sends and template resubmission. Every URL of this shape resolves to a
// database row instead of a filesystem path.
const DB_UPLOAD_PREFIX = "/uploads/db/";

export function isDbUploadUrl(mediaUrl: string): boolean {
  return mediaUrl.startsWith(DB_UPLOAD_PREFIX);
}

export function dbUploadUrl(id: string): string {
  return `${DB_UPLOAD_PREFIX}${id}`;
}

function dbUploadIdFromUrl(mediaUrl: string): string | null {
  return isDbUploadUrl(mediaUrl) ? mediaUrl.slice(DB_UPLOAD_PREFIX.length) : null;
}

export async function saveUploadedMedia(params: {
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
  userId?: string;
  phoneNumberId?: string | null;
}): Promise<{ id: string; url: string }> {
  const row = await storage.saveUploadedFile({
    userId: params.userId,
    phoneNumberId: params.phoneNumberId || undefined,
    originalName: params.originalName,
    mimeType: params.mimeType,
    size: params.buffer.length,
    data: params.buffer.toString("base64"),
  });
  return { id: row.id, url: dbUploadUrl(row.id) };
}

// Resolves any header media URL (database-backed, or legacy local-disk path
// from before this fix) back to raw bytes, or null if it's not resolvable.
export async function getUploadedMediaBuffer(
  mediaUrl: string
): Promise<{ buffer: Buffer; mimeType: string; originalName: string | null } | null> {
  const id = dbUploadIdFromUrl(mediaUrl);
  if (!id) return null;
  const row = await storage.getUploadedFile(id);
  if (!row) return null;
  return { buffer: Buffer.from(row.data, "base64"), mimeType: row.mimeType, originalName: row.originalName };
}

export async function deleteUploadedMedia(mediaUrl: string): Promise<boolean> {
  const id = dbUploadIdFromUrl(mediaUrl);
  if (!id) return false;
  return storage.deleteUploadedFile(id);
}

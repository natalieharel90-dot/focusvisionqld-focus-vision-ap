import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

const MESSAGE_BUCKET = "message-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export type MessageAttachment = {
  path: string;
  signed_url: string | null;
};

// Generate signed URLs for an array of object paths. Returns null URLs
// for paths that fail to sign (logged for the operator).
export async function signMessageAttachments(
  supabase: SupabaseClient<Database>,
  paths: string[]
): Promise<MessageAttachment[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(MESSAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("[messages] signMessageAttachments failed", error);
    return paths.map((p) => ({ path: p, signed_url: null }));
  }
  return data.map((d) => ({
    path: d.path ?? "",
    signed_url: d.signedUrl ?? null,
  }));
}

// Parses an attachments JSONB cell into a flat list of object paths.
// We store attachments as an array of strings (each a storage path).
export function attachmentPathsFrom(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export type AttachmentKind = "image" | "video" | "document";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif"];
const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "avi", "mkv"];

// Classifies an attachment path by file extension so the message UI can
// render it as an image, a video player, or a document download link.
export function attachmentKind(path: string): AttachmentKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  return "document";
}

// The filename of an attachment, with its folder stripped.
export function attachmentFilename(path: string): string {
  return path.split("/").pop() ?? path;
}

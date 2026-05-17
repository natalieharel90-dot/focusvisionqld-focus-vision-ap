"use client";

import { useState, type ChangeEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  // e.g. 'message-attachments'
  bucket: string;
  // First folder segment for RLS. e.g. the thread id, or auth.uid().
  folder: string;
  // compact → an icon-only paperclip, for the chat composer row.
  compact?: boolean;
};

// Uploads a single optional image to Supabase Storage on file select,
// and stashes the resulting object path in a hidden `attachment_path`
// form input so the enclosing form's server action receives it on
// submit. Multi-attachment support is a later concern.
export function AttachmentField({ bucket, folder, compact = false }: Props) {
  const [path, setPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const objectPath = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      setPath(objectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (compact) {
    return (
      <label
        title={error ?? (path ? "Photo attached" : "Attach a photo")}
        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-6 w-6 ${
            error
              ? "text-red-600"
              : path
                ? "text-fv-accent-strong"
                : "text-fv-accent-strong/70"
          }`}
        >
          <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          disabled={uploading || path !== null}
          className="sr-only"
        />
        {path ? (
          <input type="hidden" name="attachment_path" value={path} />
        ) : null}
      </label>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="cursor-pointer rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5 font-medium text-fv-text-primary">
        {path ? "Photo attached ✓" : uploading ? "Uploading…" : "📎 Attach photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          disabled={uploading || path !== null}
          className="sr-only"
        />
      </label>
      {error ? <span className="text-red-600">{error}</span> : null}
      {path ? (
        <input type="hidden" name="attachment_path" value={path} />
      ) : null}
    </div>
  );
}

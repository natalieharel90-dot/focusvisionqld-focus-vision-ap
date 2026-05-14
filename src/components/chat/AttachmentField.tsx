"use client";

import { useState, type ChangeEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  // e.g. 'message-attachments'
  bucket: string;
  // First folder segment for RLS. e.g. the thread id, or auth.uid().
  folder: string;
};

// Uploads a single optional image to Supabase Storage on file select,
// and stashes the resulting object path in a hidden `attachment_path`
// form input so the enclosing form's server action receives it on
// submit. Multi-attachment support is a later concern.
export function AttachmentField({ bucket, folder }: Props) {
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

  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="cursor-pointer rounded-md border border-fv-bg-soft bg-white px-3 py-1.5 font-medium text-fv-text-primary">
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

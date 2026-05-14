"use client";

import { useState, type ChangeEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  patientId: string;
};

// File picker that uploads straight to Supabase Storage. The resulting
// object path is stashed in a hidden form input so the parent form's
// server action receives it on submit.
//
// RLS on the patient-photos bucket requires the first folder segment to
// equal auth.uid(), so the path is `<patientId>/<random>.<ext>`.
export function PhotoUploadField({ patientId }: Props) {
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
      const objectPath = `${patientId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("patient-photos")
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
    <div className="rounded-2xl border border-dashed border-fv-bg-soft p-5 text-sm">
      <div className="font-semibold text-fv-text-primary">
        Optional: a photo of your eye
      </div>
      <p className="mt-1 text-xs text-fv-text-secondary">
        Helps your care team see what you&apos;re experiencing today.
      </p>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        disabled={uploading || path !== null}
        className="mt-3 block w-full text-sm text-fv-text-primary"
      />
      {uploading ? (
        <p className="mt-2 text-xs text-fv-text-secondary">Uploading…</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      ) : null}
      {path ? (
        <p className="mt-2 text-xs font-semibold text-fv-accent-strong">
          Photo attached ✓
        </p>
      ) : null}
      {path ? <input type="hidden" name="photo_path" value={path} /> : null}
    </div>
  );
}

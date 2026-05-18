"use client";

import { useState, type ChangeEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  patientId: string;
};

// The optional eye-photo card. Uploads straight to Supabase Storage and
// stashes the object path in a hidden input for the check-in action.
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
    <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-fv-text-primary">
          Eye photo
        </h2>
        <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-semibold text-fv-text-secondary">
          Optional
        </span>
      </div>
      <p className="mt-1 text-sm text-fv-text-secondary">
        Adding a quick photo helps your care team see what you&apos;re
        seeing. Skip if you&apos;d rather not.
      </p>

      <label
        className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed py-6 ${
          path ? "border-fv-accent" : "border-fv-bg-soft"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleChange}
          disabled={uploading || path !== null}
          className="sr-only"
        />
        <span className="grid h-14 w-14 place-items-center rounded-xl bg-fv-bg-accent-soft text-fv-accent-strong">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </span>
        <span className="font-semibold text-fv-text-primary">
          {path
            ? "Photo attached ✓"
            : uploading
              ? "Uploading…"
              : "Take a photo"}
        </span>
        <span className="text-xs text-fv-text-secondary">
          Front camera will open · auto-aligned
        </span>
      </label>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {path ? <input type="hidden" name="photo_path" value={path} /> : null}
    </section>
  );
}

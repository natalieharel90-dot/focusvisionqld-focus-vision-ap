"use client";

import { useState, type ChangeEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  patientId: string;
};

// The optional eye-photo card. The patient takes a photo, checks the
// preview, and only on "Use this photo" is it uploaded to Storage and the
// object path stashed in a hidden input for the check-in action.
//
// RLS on the patient-photos bucket requires the first folder segment to
// equal auth.uid(), so the path is `<patientId>/<random>.<ext>`.
export function PhotoUploadField({ patientId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  // Discard the current photo and return to the camera prompt.
  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setPath(null);
    setError(null);
  }

  // Upload the previewed photo and attach it to the check-in.
  async function confirmPhoto() {
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

      {previewUrl ? (
        <div className="mt-3 flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="The eye photo you just took"
            className="max-h-72 w-full rounded-xl bg-fv-bg-soft object-contain"
          />
          {path ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-fv-accent-strong">
                Photo attached ✓
              </span>
              <button
                type="button"
                onClick={retake}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fv-text-secondary hover:bg-fv-bg-soft"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmPhoto}
                disabled={uploading}
                className="flex-1 rounded-xl bg-fv-accent-strong px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {uploading ? "Attaching…" : "Use this photo"}
              </button>
              <button
                type="button"
                onClick={retake}
                disabled={uploading}
                className="rounded-xl border border-fv-border px-4 py-2.5 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft disabled:opacity-60"
              >
                Retake
              </button>
            </div>
          )}
        </div>
      ) : (
        <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-fv-bg-soft py-6">
          <input
            type="file"
            accept="image/*"
            capture="user"
            onChange={pickFile}
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
            Take a photo
          </span>
          <span className="text-xs text-fv-text-secondary">
            Front camera will open — you can check it before attaching
          </span>
        </label>
      )}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {path ? <input type="hidden" name="photo_path" value={path} /> : null}
    </section>
  );
}

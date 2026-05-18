"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { AutoGrowTextarea } from "@/components/chat/AutoGrowTextarea";
import { SubmitButton } from "@/components/SubmitButton";
import { sendPatientMessageAction } from "./actions";

type Props = {
  // The message thread id — also the storage folder for attachments.
  threadId: string;
};

// Images and common document types a patient might need to share.
const ACCEPT = "image/*,.pdf,.doc,.docx,.txt";

// The patient message composer: attach an image or document, see it
// confirmed in a chip (with a link to open it before sending), type an
// optional message, and send. A message OR an attachment is enough.
export function PatientMessageComposer({ threadId }: Props) {
  const [path, setPath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Drops the current attachment and frees its preview URL. Uses
  // functional state updates so it stays correct without re-binding.
  function clearAttachment() {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPath(null);
    setFileName(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Once a message is sent, clear the attachment so the next one starts
  // fresh. Deferred past the submit so the path is still posted.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    function onSubmit() {
      requestAnimationFrame(clearAttachment);
    }
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const objectPath = `${threadId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(objectPath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      setPath(objectPath);
      setFileName(file.name);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't attach that file."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={sendPatientMessageAction}
      className="sticky bottom-20 flex flex-col gap-2 border-t border-fv-border bg-fv-bg-card px-3 py-3"
    >
      {fileName ? (
        <div className="flex items-center gap-2 rounded-xl bg-fv-bg-soft px-3 py-2">
          <span aria-hidden className="shrink-0 text-fv-accent-strong">
            📎
          </span>
          <a
            href={previewUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-medium text-fv-accent-strong underline"
          >
            {fileName}
          </a>
          <span className="shrink-0 text-xs text-fv-text-secondary">
            Tap to view
          </span>
          <button
            type="button"
            onClick={clearAttachment}
            aria-label="Remove attachment"
            className="shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold text-fv-text-secondary hover:bg-fv-bg-card"
          >
            ✕
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex items-center gap-2">
        <label
          title="Attach an image or document"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-fv-accent-strong ${
            uploading || path ? "opacity-40" : "cursor-pointer"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFile}
            disabled={uploading || path !== null}
            className="sr-only"
          />
        </label>

        <AutoGrowTextarea
          name="body"
          rows={1}
          placeholder={uploading ? "Attaching file…" : "Type a message…"}
          className="min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-fv-border bg-fv-bg-app px-4 py-2.5 text-sm text-fv-text-primary placeholder:text-fv-text-secondary max-h-32"
        />

        <SubmitButton
          aria-label="Send message"
          disabled={uploading}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-white hover:opacity-95"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
        </SubmitButton>
      </div>

      {path ? (
        <input type="hidden" name="attachment_path" value={path} />
      ) : null}
    </form>
  );
}

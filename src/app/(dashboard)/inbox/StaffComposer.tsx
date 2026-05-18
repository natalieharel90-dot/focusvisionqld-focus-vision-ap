"use client";

import { useEffect, useRef, useState } from "react";

import { AttachmentField } from "@/components/chat/AttachmentField";
import { sendStaffMessageAction } from "./actions";

type Template = {
  id: string;
  label: string;
  body: string;
  category: string | null;
};

type Props = {
  threadId: string;
  templates: ReadonlyArray<Template>;
};

// Quick-reply chips pre-fill the compose box (staff can still edit before
// sending — tapping a chip never auto-sends). Client component because the
// textarea is controlled by chip selection, auto-grows with its content,
// and is cleared once a reply has been sent.
export function StaffComposer({ threadId, templates }: Props) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  // Grow the box to fit its content — typing or a tapped template.
  useEffect(resize, [body]);

  // Empty the box once a reply has been sent.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    function handleSubmit() {
      requestAnimationFrame(() => setBody(""));
    }
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, []);

  return (
    <div className="border-t border-fv-bg-soft">
      {templates.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto px-4 py-2.5">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setBody(t.body)}
              title={t.body}
              className="shrink-0 rounded-full border border-fv-border px-3 py-1.5 text-xs font-medium text-fv-text-primary hover:bg-fv-bg-soft"
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        ref={formRef}
        action={sendStaffMessageAction}
        className="flex items-end gap-2 px-4 py-3"
      >
        <input type="hidden" name="thread_id" value={threadId} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <textarea
            ref={textareaRef}
            name="body"
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a reply…"
            className="max-h-32 w-full resize-none overflow-y-auto rounded-xl border border-fv-bg-soft bg-fv-bg-app px-3 py-2 text-sm"
          />
          <AttachmentField bucket="message-attachments" folder={threadId} />
        </div>
        <button
          type="submit"
          aria-label="Send reply"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-white hover:opacity-90"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}

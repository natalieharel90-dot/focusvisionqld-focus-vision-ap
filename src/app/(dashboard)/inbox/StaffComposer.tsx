"use client";

import { useState } from "react";

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
// textarea is controlled by chip selection.
export function StaffComposer({ threadId, templates }: Props) {
  const [body, setBody] = useState("");

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
        action={sendStaffMessageAction}
        className="flex items-end gap-2 px-4 py-3"
      >
        <input type="hidden" name="thread_id" value={threadId} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <textarea
            name="body"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a reply…"
            className="w-full resize-none rounded-xl border border-fv-bg-soft bg-fv-bg-app px-3 py-2 text-sm"
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

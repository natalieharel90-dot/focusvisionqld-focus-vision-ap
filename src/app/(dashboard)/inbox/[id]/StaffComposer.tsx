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

// Picks a quick-reply template into the textarea (staff can still edit
// before sending). Client component because the textarea needs to be
// controlled by template selection.
export function StaffComposer({ threadId, templates }: Props) {
  const [body, setBody] = useState("");

  return (
    <form
      action={sendStaffMessageAction}
      className="flex flex-col gap-2 rounded-xl bg-fv-bg-card p-3 shadow-sm"
    >
      <input type="hidden" name="thread_id" value={threadId} />

      {templates.length > 0 ? (
        <select
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) setBody(t.body);
            e.currentTarget.selectedIndex = 0;
          }}
          defaultValue=""
          className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5 text-sm"
        >
          <option value="">Insert template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
              {t.category ? ` · ${t.category}` : ""}
            </option>
          ))}
        </select>
      ) : null}

      <textarea
        name="body"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Type a reply…"
        className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm"
      />

      <div className="flex items-center justify-between gap-2">
        <AttachmentField bucket="message-attachments" folder={threadId} />
        <button
          type="submit"
          className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
        >
          Send reply
        </button>
      </div>
    </form>
  );
}

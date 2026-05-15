"use client";

import { useRef } from "react";

import { MESSAGE_TEMPLATE_CATEGORIES } from "@/lib/clinic-settings";
import { saveTemplateAction } from "./actions";

export type Template = {
  id: string;
  label: string;
  body: string;
  category: string | null;
  order_index: number;
  active: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";
const labelClass = "text-xs font-medium text-fv-text-secondary";

export function TemplateModal({ template }: { template: Template | null }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={
          template
            ? "text-xs font-medium text-fv-accent-strong hover:underline"
            : "rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        }
      >
        {template ? "Edit" : "+ Add template"}
      </button>

      <dialog
        ref={ref}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <form
          action={saveTemplateAction}
          onSubmit={() => ref.current?.close()}
          className="flex flex-col gap-3 p-5"
        >
          <h2 className="text-base font-semibold text-fv-text-primary">
            {template ? "Edit template" : "Add message template"}
          </h2>
          {template ? (
            <input type="hidden" name="id" value={template.id} />
          ) : null}

          <label>
            <span className={labelClass}>Label</span>
            <input
              name="label"
              required
              defaultValue={template?.label ?? ""}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Category</span>
            <select
              name="category"
              defaultValue={template?.category ?? "general"}
              className={inputClass}
            >
              {MESSAGE_TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Body</span>
            <textarea
              name="body"
              required
              rows={5}
              defaultValue={template?.body ?? ""}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-fv-text-secondary">
              Use <code>{"{patient_first_name}"}</code> — it expands to the
              patient&apos;s name when the message is sent.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
            >
              {template ? "Save" : "Add template"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

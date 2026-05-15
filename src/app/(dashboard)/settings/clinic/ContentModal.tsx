"use client";

import { useRef } from "react";

import { CONTENT_TOPICS } from "@/lib/clinic-settings";
import { saveContentItemAction } from "./actions";

const PROCEDURE_TYPES = ["lasik", "prk", "smile", "cataract", "icl"];

export type ContentItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  media_url: string | null;
  procedures: string[];
  days_range: string | null;
  topics: string[];
  audience: string;
  active: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";
const labelClass = "text-xs font-medium text-fv-text-secondary";

export function ContentModal({ item }: { item: ContentItem | null }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={
          item
            ? "text-xs font-medium text-fv-accent-strong hover:underline"
            : "rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        }
      >
        {item ? "Edit" : "+ Add content"}
      </button>

      <dialog
        ref={ref}
        className="w-full max-w-lg rounded-2xl p-0 backdrop:bg-black/40"
      >
        <form
          action={saveContentItemAction}
          onSubmit={() => ref.current?.close()}
          className="flex flex-col gap-3 p-5"
        >
          <h2 className="text-base font-semibold text-fv-text-primary">
            {item ? "Edit content item" : "Add content item"}
          </h2>
          {item ? <input type="hidden" name="id" value={item.id} /> : null}

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>Type</span>
              <select
                name="type"
                defaultValue={item?.type ?? "article"}
                className={inputClass}
              >
                <option value="article">Article</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Audience</span>
              <select
                name="audience"
                defaultValue={item?.audience ?? "both"}
                className={inputClass}
              >
                <option value="pre_op">Pre-op</option>
                <option value="post_op">Post-op</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>

          <label>
            <span className={labelClass}>Title</span>
            <input
              name="title"
              required
              defaultValue={item?.title ?? ""}
              className={inputClass}
            />
          </label>

          <label>
            <span className={labelClass}>Body (for articles)</span>
            <textarea
              name="body"
              rows={4}
              defaultValue={item?.body ?? ""}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Media URL (for videos)</span>
            <input
              name="media_url"
              defaultValue={item?.media_url ?? ""}
              placeholder="https://…"
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>
              Days range (e.g. &ldquo;1-7&rdquo;, &ldquo;0&rdquo;,
              &ldquo;30+&rdquo;)
            </span>
            <input
              name="days_range"
              defaultValue={item?.days_range ?? ""}
              className={inputClass}
            />
          </label>

          <fieldset>
            <span className={labelClass}>Procedures</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {PROCEDURE_TYPES.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-1 rounded-full border border-fv-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    name="procedures"
                    value={p}
                    defaultChecked={item?.procedures.includes(p) ?? false}
                  />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <span className={labelClass}>Topics</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {CONTENT_TOPICS.map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-1 rounded-full border border-fv-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    name="topics"
                    value={t}
                    defaultChecked={item?.topics.includes(t) ?? false}
                  />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>

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
              {item ? "Save" : "Add content"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

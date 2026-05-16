"use client";

import { useRef } from "react";

import { addSymptomAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";
const labelClass = "text-xs font-medium text-fv-text-secondary";

// "+ Add symptom" button + the add dialog. Adding a symptom auto-creates
// an Orange routing rule in the Default ruleset (DB trigger).
export function AddSymptomModal() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-lg border border-fv-border bg-fv-bg-card px-3 py-1.5 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
      >
        + Add symptom
      </button>

      <dialog
        ref={ref}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-fv-text-primary">
              Add symptom option
            </h2>
            <p className="mt-0.5 text-xs text-fv-text-secondary">
              A default routing rule (Orange) is created automatically —
              adjust it in Alert thresholds if needed.
            </p>
          </div>

          <form
            action={addSymptomAction}
            onSubmit={() => ref.current?.close()}
            className="flex flex-col gap-3"
          >
            <label>
              <span className={labelClass}>Label</span>
              <input
                name="label"
                required
                placeholder="e.g. Blurred vision"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Key (snake_case)</span>
              <input
                name="key"
                required
                placeholder="e.g. blurred_vision"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Order index</span>
              <input
                type="number"
                name="order_index"
                defaultValue={120}
                className={inputClass}
              />
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
                Add symptom
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

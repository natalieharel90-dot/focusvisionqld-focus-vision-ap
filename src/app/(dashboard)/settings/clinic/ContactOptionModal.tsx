"use client";

import { useRef } from "react";

import { CONTACT_ACTION_TYPES, CONTACT_ICONS } from "@/lib/clinic-settings";
import { saveContactOptionAction } from "./actions";

export type ContactOption = {
  id: string;
  label: string;
  subtitle: string | null;
  icon: string;
  action_type: string;
  action_value: string | null;
  order_index: number;
  enabled: boolean;
  is_required: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";
const labelClass = "text-xs font-medium text-fv-text-secondary";

export function ContactOptionModal({
  option,
}: {
  option: ContactOption | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const required = option?.is_required ?? false;

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={
          option
            ? "text-xs font-medium text-fv-accent-strong hover:underline"
            : "rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        }
      >
        {option ? "Edit" : "+ Add contact option"}
      </button>

      <dialog
        ref={ref}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <form
          action={saveContactOptionAction}
          onSubmit={() => ref.current?.close()}
          className="flex flex-col gap-3 p-5"
        >
          <h2 className="text-base font-semibold text-fv-text-primary">
            {option ? "Edit contact option" : "Add contact option"}
          </h2>
          {option ? (
            <input type="hidden" name="id" value={option.id} />
          ) : null}

          <label>
            <span className={labelClass}>Label</span>
            <input
              name="label"
              required
              defaultValue={option?.label ?? ""}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Subtitle</span>
            <input
              name="subtitle"
              defaultValue={option?.subtitle ?? ""}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>Icon</span>
              <select
                name="icon"
                defaultValue={option?.icon ?? "phone"}
                className={inputClass}
              >
                {CONTACT_ICONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Action type</span>
              <select
                name="action_type"
                defaultValue={option?.action_type ?? "call"}
                className={inputClass}
              >
                {CONTACT_ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className={labelClass}>
              Action value (phone / URL / /deep-link / address)
            </span>
            <input
              name="action_value"
              defaultValue={option?.action_value ?? ""}
              className={inputClass}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={option?.enabled ?? true}
              disabled={required}
            />
            <span className="text-fv-text-primary">
              Enabled
              {required ? " — required, cannot be turned off 🔒" : ""}
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
              {option ? "Save" : "Add option"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

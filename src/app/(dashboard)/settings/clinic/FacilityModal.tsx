"use client";

import { useRef } from "react";

import { saveFacilityAction, toggleFacilityActiveAction } from "./actions";

export type Facility = {
  id: string;
  name: string;
  address: string | null;
  liaison_email: string | null;
  liaison_phone: string | null;
  notes: string | null;
  active: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";
const labelClass = "text-xs font-medium text-fv-text-secondary";

export function FacilityModal({ facility }: { facility: Facility | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inactive = facility != null && !facility.active;

  return (
    <>
      {facility ? (
        <button
          type="button"
          onClick={() => ref.current?.showModal()}
          className="w-full rounded-lg border border-fv-border bg-fv-bg-card px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
        >
          Edit
        </button>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.showModal()}
          className="rounded-lg border border-fv-border bg-fv-bg-card px-3 py-1.5 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
        >
          + Add partner
        </button>
      )}

      <dialog
        ref={ref}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <h2 className="text-base font-semibold text-fv-text-primary">
            {facility ? "Edit facility" : "Add partner facility"}
          </h2>

          <form
            action={saveFacilityAction}
            onSubmit={() => ref.current?.close()}
            className="flex flex-col gap-3"
          >
            {facility ? (
              <input type="hidden" name="id" value={facility.id} />
            ) : null}
            <label>
              <span className={labelClass}>Name</span>
              <input
                name="name"
                required
                defaultValue={facility?.name ?? ""}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Address</span>
              <input
                name="address"
                defaultValue={facility?.address ?? ""}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={labelClass}>Liaison email</span>
                <input
                  name="liaison_email"
                  type="email"
                  defaultValue={facility?.liaison_email ?? ""}
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Liaison phone</span>
                <input
                  name="liaison_phone"
                  defaultValue={facility?.liaison_phone ?? ""}
                  className={inputClass}
                />
              </label>
            </div>
            <label>
              <span className={labelClass}>Notes</span>
              <textarea
                name="notes"
                rows={3}
                defaultValue={facility?.notes ?? ""}
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
              {!inactive ? (
                <button
                  type="submit"
                  className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
                >
                  {facility ? "Save" : "Add facility"}
                </button>
              ) : null}
            </div>
          </form>

          {facility ? (
            <form
              action={toggleFacilityActiveAction}
              onSubmit={() => ref.current?.close()}
              className="border-t border-fv-bg-soft pt-3"
            >
              <input type="hidden" name="id" value={facility.id} />
              <input
                type="hidden"
                name="active"
                value={inactive ? "true" : "false"}
              />
              <button
                type="submit"
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  inactive
                    ? "bg-fv-accent-strong text-white"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {inactive ? "Reactivate" : "Deactivate (soft-delete)"}
              </button>
            </form>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

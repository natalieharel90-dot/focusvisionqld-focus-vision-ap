"use client";

import { useRef } from "react";

import { raiseFlagAction } from "./actions";

type Props = {
  patientId: string;
};

// Manual flag modal: native <dialog> opened from a button, submits to the
// existing raiseFlagAction. Red flags trigger the same staff alert path
// as a Red-routed check-in, but the patient's app view is unchanged
// (patients never see Red).
export function FlagPatientModal({ patientId }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-900"
      >
        🚩 Raise a flag
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-black/40"
      >
        <form
          action={raiseFlagAction}
          onSubmit={() => dialogRef.current?.close()}
          className="flex flex-col gap-4 p-5"
        >
          <header>
            <h2 className="text-base font-semibold text-fv-text-primary">
              Flag patient for review
            </h2>
            <p className="mt-1 text-xs text-fv-text-secondary">
              Use when you&apos;ve discovered something concerning outside the
              daily check-in flow.
            </p>
          </header>

          <input type="hidden" name="patient_id" value={patientId} />

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
              Staff alert level
            </legend>
            <label className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 cursor-pointer">
              <input type="radio" name="alert_level" value="yellow" required />
              <span>
                <strong>Yellow</strong> — review within 4h
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 cursor-pointer">
              <input type="radio" name="alert_level" value="orange" />
              <span>
                <strong>Orange</strong> — contact today
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 cursor-pointer">
              <input type="radio" name="alert_level" value="red" />
              <span>
                <strong>Red</strong> — urgent, page on-call
              </span>
            </label>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
              Reason (audit logged)
            </span>
            <textarea
              name="reason"
              required
              rows={3}
              placeholder="What you observed, why this needs review."
              className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm"
            />
          </label>

          <p className="rounded-md bg-fv-bg-soft px-3 py-2 text-xs text-fv-text-secondary">
            Red flags trigger the same staff alert actions as a Red-routed
            check-in (SMS + auto-call to on-call). The patient&apos;s app
            stays on the Orange screen — they never see Red.
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
            >
              Raise flag
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

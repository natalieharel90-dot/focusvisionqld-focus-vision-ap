"use client";

import { useRef } from "react";

import { updateAfterHoursOptInAction } from "./after-hours-actions";

// Small auto-submit toggle for the surgeon after-hours opt-in. Posts
// the form on change so the surgeon doesn't have to find a "Save"
// button — the change is the save.
export function AfterHoursToggle({ initial }: { initial: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={updateAfterHoursOptInAction}
      className="mt-3 flex items-center justify-between gap-3"
    >
      <span className="text-sm font-medium text-fv-text-primary">
        Send me after-hours alerts for my patients
      </span>
      <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          name="notify_after_hours"
          defaultChecked={initial}
          onChange={() => formRef.current?.requestSubmit()}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-fv-bg-soft transition-colors peer-checked:bg-fv-accent-strong" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </label>
    </form>
  );
}

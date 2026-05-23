"use client";

import { useRef } from "react";

import { updateOnShiftAction } from "./shift-actions";

// Quick auto-submit toggle for "I'm on shift". The dispatcher's
// general in-app push only reaches staff whose on_shift is true.
export function OnShiftToggle({ initial }: { initial: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={updateOnShiftAction}
      className="mt-3 flex items-center justify-between gap-3"
    >
      <span className="text-sm font-medium text-fv-text-primary">
        I&apos;m on shift right now
      </span>
      <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          name="on_shift"
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

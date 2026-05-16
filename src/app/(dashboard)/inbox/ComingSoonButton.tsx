"use client";

import { useState } from "react";

type Props = {
  label: string;
  hint: string;
  variant?: "primary" | "secondary";
};

// A button for a deferred feature — clicking reveals an inline "coming
// soon" hint rather than silently doing nothing.
export function ComingSoonButton({ label, hint, variant = "secondary" }: Props) {
  const [open, setOpen] = useState(false);
  const cls =
    variant === "primary"
      ? "bg-fv-accent-strong text-white hover:opacity-90"
      : "border border-fv-border text-fv-text-primary hover:bg-fv-bg-soft";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-md px-4 py-2 text-sm font-semibold ${cls}`}
      >
        {label}
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-fv-bg-soft bg-fv-bg-card p-3 text-xs text-fv-text-secondary shadow-lg">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

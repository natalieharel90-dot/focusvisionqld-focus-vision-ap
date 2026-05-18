"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  // Text shown next to the spinner while the action runs. Omit for
  // icon-only buttons — they just show the spinner.
  pendingLabel?: string;
  // Disables the button for reasons beyond the form being in flight
  // (e.g. an attachment still uploading).
  disabled?: boolean;
  "aria-label"?: string;
  title?: string;
};

// A submit button that shows a clear working state — a spinner, plus an
// optional label — while its form's action runs, so it is obvious the tap
// registered and is being processed. Must be rendered inside a <form>.
export function SubmitButton({
  children,
  className,
  pendingLabel,
  disabled,
  "aria-label": ariaLabel,
  title,
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      aria-label={ariaLabel}
      title={title}
      className={`${className ?? ""} ${
        pending ? "cursor-wait opacity-80" : ""
      }`}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z"
            />
          </svg>
          {pendingLabel ? <span>{pendingLabel}</span> : null}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

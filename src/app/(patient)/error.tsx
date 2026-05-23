"use client";

import { useEffect } from "react";

// Patient-app error boundary. Catches anything thrown during the
// (patient) route-group render and shows the actual error message so
// we can debug without browser-console access on the patient's phone.
// Tap "Try again" to re-render — most transient errors will recover.
export default function PatientErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Forwards to the Vercel runtime logs so we can also see it server-side.
    console.error("[patient] render error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-fv-bg-app px-5 py-10 text-center">
      <h1 className="text-2xl font-bold text-fv-text-primary">
        Something went wrong
      </h1>
      <p className="text-sm text-fv-text-secondary">
        The patient app hit an error rendering this screen. Try again — most
        errors are temporary.
      </p>
      <details className="mt-2 max-w-md rounded-2xl bg-fv-bg-card p-4 text-left text-xs text-fv-text-secondary shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-fv-text-primary">
          Error details
        </summary>
        <p className="mt-2 break-words font-mono">{error.message}</p>
        {error.digest ? (
          <p className="mt-1 break-words font-mono opacity-75">
            digest: {error.digest}
          </p>
        ) : null}
      </details>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-fv-accent-strong px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
        >
          Try again
        </button>
        <a
          href="/patient-sign-in"
          className="rounded-xl border border-fv-border px-5 py-2.5 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
        >
          Sign in again
        </a>
      </div>
    </main>
  );
}

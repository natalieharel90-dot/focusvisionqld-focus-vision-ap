import Link from "next/link";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { requestPasswordResetAction } from "./actions";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { sent?: string; from?: string; error?: string };
}) {
  const backHref =
    searchParams.from === "patient" ? "/patient-sign-in" : "/sign-in";
  const sent = searchParams.sent === "1";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 pb-8">
          <FocusVisionLogo size={120} />
          <h1 className="text-xl font-semibold text-fv-text-primary">
            Reset your password
          </h1>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm">
            <p className="text-sm text-fv-text-primary">
              If an account exists for that email address, we&apos;ve sent it
              a link to reset the password. Check your inbox — and your spam
              folder — then follow the link to choose a new password.
            </p>
            <Link
              href={backHref}
              className="text-center text-sm font-semibold text-fv-accent-strong"
            >
              Back to sign-in
            </Link>
          </div>
        ) : (
          <>
            <form
              action={requestPasswordResetAction}
              className="flex flex-col gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm"
            >
              <input
                type="hidden"
                name="from"
                value={searchParams.from ?? ""}
              />
              <p className="text-sm text-fv-text-secondary">
                Enter the email address for your account and we&apos;ll send
                you a link to set a new password.
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fv-text-primary">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-base"
                />
              </label>

              {searchParams.error ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {searchParams.error}
                </p>
              ) : null}

              <button
                type="submit"
                className="mt-2 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Send reset link
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-fv-text-secondary">
              <Link
                href={backHref}
                className="font-semibold text-fv-accent-strong"
              >
                Back to sign-in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

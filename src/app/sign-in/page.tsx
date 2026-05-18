import Link from "next/link";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { PasswordInput } from "@/components/PasswordInput";
import { signInWithPasswordAction } from "./actions";

export const dynamic = "force-dynamic";

export default function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string; reset?: string; next?: string };
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 pb-8">
          <FocusVisionLogo size={120} />
          <h1 className="text-xl font-semibold text-fv-text-primary">
            Staff sign-in
          </h1>
        </div>

        <form
          action={signInWithPasswordAction}
          className="flex flex-col gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm"
        >
          <input type="hidden" name="next" value={searchParams.next ?? ""} />
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">Password</span>
            <PasswordInput
              name="password"
              required
              autoComplete="current-password"
              minLength={8}
              className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-base"
            />
          </label>

          <Link
            href="/reset-password"
            className="-mt-1 self-end text-xs font-semibold text-fv-accent-strong"
          >
            Forgot your password?
          </Link>

          {searchParams.reset === "1" ? (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
              Your password has been updated. Sign in with your new password.
            </p>
          ) : null}

          {searchParams.error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {searchParams.error}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-2 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Continue
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-fv-text-secondary">
          New staff member?{" "}
          <Link href="/sign-up" className="font-semibold text-fv-accent-strong">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}

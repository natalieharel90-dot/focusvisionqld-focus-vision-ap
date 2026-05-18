import Link from "next/link";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { signUpAction } from "./actions";

export const dynamic = "force-dynamic";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { error?: string; check_email?: string };
}) {
  if (searchParams.check_email) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <FocusVisionLogo size={100} />
          <h1 className="mt-6 text-xl font-semibold text-fv-text-primary">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-fv-text-secondary">
            We sent a confirmation link to{" "}
            <strong>{searchParams.check_email}</strong>. Click it to finish
            setting up your account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 pb-8">
          <FocusVisionLogo size={120} />
          <h1 className="text-xl font-semibold text-fv-text-primary">
            Staff registration
          </h1>
          <p className="text-center text-sm text-fv-text-secondary">
            Restricted to <code>@focusvision.com.au</code> and{" "}
            <code>@qei.org.au</code> emails.
          </p>
        </div>

        <form
          action={signUpAction}
          className="flex flex-col gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">Full name</span>
            <input
              type="text"
              name="name"
              required
              className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">
              Work email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@focusvision.com.au"
              className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">Role</span>
            <select
              name="role"
              required
              defaultValue="nurse"
              className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-base"
            >
              <option value="surgeon">Surgeon</option>
              <option value="optometrist">Optometrist</option>
              <option value="nurse">Nurse</option>
              <option value="reception">Reception</option>
              <option value="clinic manager">Clinic Manager</option>
              <option value="administration">Administration</option>
              <option value="it">IT</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              minLength={8}
              className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">
              Invite code
            </span>
            <input
              type="text"
              name="invite_code"
              required
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
            Register
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-fv-text-secondary">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-fv-accent-strong">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

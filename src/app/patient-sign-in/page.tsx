import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { patientSignInAction } from "./actions";

export const dynamic = "force-dynamic";

export default function PatientSignInPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 pb-8">
          <FocusVisionLogo size={120} />
          <h1 className="text-xl font-semibold text-fv-text-primary">
            Patient sign-in
          </h1>
          <p className="text-center text-sm text-fv-text-secondary">
            Use the email and password from your welcome message.
          </p>
        </div>

        <form
          action={patientSignInAction}
          className="flex flex-col gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm"
        >
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
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
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
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-fv-text-secondary">
          SMS two-factor auth lands in the next update — for now this is
          password only.
        </p>
      </div>
    </main>
  );
}

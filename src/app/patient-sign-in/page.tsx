import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { LogoUnlockTrigger } from "@/components/LogoUnlockTrigger";
import { unlockBonusPackAction } from "@/app/(patient)/bonus-actions";
import { patientSignInAction } from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-2xl border border-fv-border bg-fv-bg-card px-4 py-3.5 text-base text-fv-text-primary placeholder:text-fv-text-secondary focus:border-fv-accent focus:outline-none";
const labelClass = "text-sm font-semibold text-fv-text-primary";

export default function PatientSignInPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="flex min-h-screen flex-col px-6 py-12">
      <div className="mx-auto flex w-full max-w-sm flex-col">
        {/* Logo */}
        <div className="mt-6 flex justify-center">
          <LogoUnlockTrigger
            action={unlockBonusPackAction}
            bridgeKey="fv_bonus_unlock"
          >
            <FocusVisionLogo size={130} />
          </LogoUnlockTrigger>
        </div>

        <h1 className="mt-8 text-center text-3xl font-bold text-fv-text-primary">
          Welcome to Focus Vision
        </h1>
        <p className="mt-2 text-center text-base text-fv-text-secondary">
          Sign in to your recovery companion.
        </p>

        <form action={patientSignInAction} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Email address</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="From your welcome message"
              className={inputClass}
            />
          </label>

          {searchParams.error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {searchParams.error}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-2 rounded-2xl bg-fv-accent-strong px-4 py-4 text-lg font-bold text-white hover:opacity-95"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 flex items-start gap-2.5 text-sm text-fv-text-secondary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-5 w-5 shrink-0 text-fv-accent-strong"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="leading-relaxed">
            Your information is encrypted and stored in Australia. Use the
            email and password from your clinic welcome message.
          </p>
        </div>
      </div>
    </main>
  );
}

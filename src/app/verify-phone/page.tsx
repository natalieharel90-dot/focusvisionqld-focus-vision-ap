import Link from "next/link";
import { redirect } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  restartPhoneVerificationAction,
  sendPhoneCodeAction,
  verifyPhoneCodeAction,
} from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-2xl border border-fv-border bg-fv-bg-card px-4 py-3.5 text-base text-fv-text-primary placeholder:text-fv-text-secondary focus:border-fv-accent focus:outline-none";
const labelClass = "text-sm font-semibold text-fv-text-primary";
const buttonClass =
  "mt-2 rounded-2xl bg-fv-accent-strong px-4 py-4 text-lg font-bold text-white hover:opacity-95";

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 3)} ··· ··· ${phone.slice(-3)}`;
}

function LockNote({ children }: { children: React.ReactNode }) {
  return (
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
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: { error?: string; devcode?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const { data: patient } = await supabase
    .from("patients")
    .select("phone_verified")
    .eq("id", user.id)
    .maybeSingle();
  if (!patient) redirect("/patient-sign-in");
  if (patient.phone_verified) redirect("/home");

  const { data: pending } = await supabase
    .from("patient_phone_verifications")
    .select("phone, expires_at")
    .eq("patient_id", user.id)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const activePending =
    pending && new Date(pending.expires_at).getTime() > Date.now()
      ? pending
      : null;

  const error = searchParams.error ? (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {searchParams.error}
    </p>
  ) : null;

  return (
    <main className="flex min-h-screen flex-col px-6 py-12">
      <div className="mx-auto flex w-full max-w-sm flex-col">
        <div className="mt-6 flex justify-center">
          <FocusVisionLogo size={110} />
        </div>

        {activePending ? (
          // ── Code entry ──────────────────────────────────────────────
          <>
            <h1 className="mt-8 text-center text-3xl font-bold text-fv-text-primary">
              Enter your code
            </h1>
            <p className="mt-2 text-center text-base text-fv-text-secondary">
              We sent a 6-digit code to {maskPhone(activePending.phone)}.
            </p>

            {searchParams.devcode ? (
              <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
                Testing only — SMS isn&apos;t connected yet. Your code is{" "}
                <strong className="tracking-widest">
                  {searchParams.devcode}
                </strong>
                .
              </p>
            ) : null}

            <form
              action={verifyPhoneCodeAction}
              className="mt-6 flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>6-digit code</span>
                <input
                  type="text"
                  name="code"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  className={`${inputClass} text-center text-2xl tracking-[0.4em]`}
                />
              </label>
              {error}
              <button type="submit" className={buttonClass}>
                Verify mobile number
              </button>
            </form>

            <form action={restartPhoneVerificationAction} className="mt-3">
              <button
                type="submit"
                className="w-full text-center text-sm font-semibold text-fv-accent-strong"
              >
                Use a different number
              </button>
            </form>

            <LockNote>
              Your information is encrypted and stored in Australia. Your
              number is only used for security and clinic contact.
            </LockNote>
          </>
        ) : (
          // ── Phone entry ─────────────────────────────────────────────
          <>
            <h1 className="mt-8 text-center text-3xl font-bold text-fv-text-primary">
              Verify your mobile
            </h1>
            <p className="mt-2 text-center text-base text-fv-text-secondary">
              Add a verified mobile number to secure your account.
            </p>

            <form
              action={sendPhoneCodeAction}
              className="mt-8 flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Mobile number</span>
                <input
                  type="tel"
                  name="phone"
                  required
                  autoComplete="tel"
                  placeholder="+61 412 345 678"
                  className={inputClass}
                />
              </label>
              <p className="text-sm text-fv-text-secondary">
                We&apos;ll text you a 6-digit code to verify your phone. Your
                number is only used for security and clinic contact.
              </p>
              {error}
              <button type="submit" className={buttonClass}>
                Send verification code
              </button>
            </form>

            <LockNote>
              Your information is encrypted and stored in Australia.
            </LockNote>
          </>
        )}

        <Link
          href="/home"
          className="mt-5 text-center text-sm font-semibold text-fv-text-secondary"
        >
          Skip for now
        </Link>
      </div>
    </main>
  );
}

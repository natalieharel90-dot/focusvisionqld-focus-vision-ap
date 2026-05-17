import Link from "next/link";
import { redirect } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PhoneCodeForm } from "./PhoneCodeForm";
import { sendPhoneCodeAction } from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-2xl border border-fv-border bg-fv-bg-card px-4 py-3.5 text-base text-fv-text-primary placeholder:text-fv-text-secondary focus:border-fv-accent focus:outline-none";
const labelClass = "text-sm font-semibold text-fv-text-primary";

// "+61412345678" → "+61 412 345 678".
function displayPhone(phone: string): string {
  return /^\+61\d{9}$/.test(phone)
    ? `+61 ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`
    : phone;
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
              We sent a 6-digit code to{" "}
              <span className="font-bold text-fv-text-primary">
                {displayPhone(activePending.phone)}
              </span>
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

            <PhoneCodeForm
              phone={activePending.phone}
              error={searchParams.error}
            />
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
              {searchParams.error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {searchParams.error}
                </p>
              ) : null}
              <button
                type="submit"
                className="mt-2 rounded-2xl bg-fv-accent-strong px-4 py-4 text-lg font-bold text-white hover:opacity-95"
              >
                Send verification code
              </button>
            </form>

            <Link
              href="/home"
              className="mt-5 text-center text-sm font-semibold text-fv-text-secondary"
            >
              Skip for now
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SubmitButton } from "@/components/SubmitButton";
import { setPatientPasswordAction } from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-2xl border border-fv-border bg-fv-bg-card px-4 py-3.5 text-base text-fv-text-primary placeholder:text-fv-text-secondary focus:border-fv-accent focus:outline-none";

export default async function PatientPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <Link
        href="/preferences/account"
        className="text-sm font-semibold text-fv-text-secondary"
      >
        ‹ Account
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          Set your password
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Choose a password only you know. If your clinic gave you a
          temporary one in your welcome message, this replaces it.
        </p>
      </header>

      <form
        action={setPatientPasswordAction}
        className="flex flex-col gap-4 rounded-2xl bg-fv-bg-card p-5 shadow-sm"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fv-text-primary">
            New password
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fv-text-primary">
            Confirm new password
          </span>
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Type it again"
            className={inputClass}
          />
        </label>

        {searchParams.error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchParams.error}
          </p>
        ) : null}

        <SubmitButton
          pendingLabel="Saving…"
          className="mt-1 rounded-2xl bg-fv-accent-strong px-4 py-4 text-lg font-bold text-white hover:opacity-95"
        >
          Save password
        </SubmitButton>
      </form>
    </main>
  );
}

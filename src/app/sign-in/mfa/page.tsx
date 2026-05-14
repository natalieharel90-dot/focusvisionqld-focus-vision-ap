import { redirect } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { verifyMfaSignInAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignInMfaPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();
  if (factorsError) {
    redirect(`/sign-in?error=${encodeURIComponent(factorsError.message)}`);
  }

  const totp = factors?.totp?.find((f) => f.status === "verified");
  if (!totp) {
    redirect("/sign-in?error=No+verified+MFA+factor+for+this+account.");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 pb-8">
          <FocusVisionLogo size={100} />
          <h1 className="text-xl font-semibold text-fv-text-primary">
            Two-factor code
          </h1>
          <p className="text-center text-sm text-fv-text-secondary">
            Open your authenticator app and enter the 6-digit code.
          </p>
        </div>

        <form
          action={verifyMfaSignInAction}
          className="flex flex-col gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm"
        >
          <input type="hidden" name="factorId" value={totp.id} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">Code</span>
            <input
              type="text"
              name="code"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-center text-lg tracking-[0.4em]"
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
            Verify
          </button>
        </form>
      </div>
    </main>
  );
}

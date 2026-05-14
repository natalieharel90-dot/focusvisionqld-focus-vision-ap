import { redirect } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { verifyEnrollmentAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignUpMfaPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Clean up any unverified TOTP factors from prior attempts so we always
  // present a single, fresh QR code on this page.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");
  if (verifiedTotp) {
    // Already enrolled — nothing to do here.
    redirect("/");
  }

  const { data: enroll, error: enrollError } =
    await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Staff TOTP",
    });
  if (enrollError || !enroll) {
    const msg = enrollError?.message ?? "Enrollment failed.";
    redirect(`/sign-up?error=${encodeURIComponent(msg)}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-4 pb-6">
          <FocusVisionLogo size={100} />
          <h1 className="text-xl font-semibold text-fv-text-primary">
            Set up two-factor authentication
          </h1>
          <p className="text-center text-sm text-fv-text-secondary">
            Scan this QR with your authenticator app (1Password, Authy, Google
            Authenticator), then enter the 6-digit code.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm">
          <div
            className="rounded-md bg-white p-3"
            dangerouslySetInnerHTML={{ __html: enroll.totp.qr_code }}
          />
          <details className="w-full text-sm text-fv-text-secondary">
            <summary className="cursor-pointer font-medium text-fv-text-primary">
              Can&apos;t scan? Enter the secret manually.
            </summary>
            <code className="mt-2 block break-all rounded bg-fv-bg-soft px-2 py-1 text-xs">
              {enroll.totp.secret}
            </code>
          </details>

          <form
            action={verifyEnrollmentAction}
            className="flex w-full flex-col gap-3 pt-3"
          >
            <input type="hidden" name="factorId" value={enroll.id} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">
                6-digit code
              </span>
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
              Verify and finish
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

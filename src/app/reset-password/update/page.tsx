import Link from "next/link";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { updatePasswordAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 pb-8">
          <FocusVisionLogo size={120} />
          <h1 className="text-xl font-semibold text-fv-text-primary">
            Choose a new password
          </h1>
        </div>

        {!user ? (
          <div className="flex flex-col gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm">
            <p className="text-sm text-fv-text-primary">
              This reset link is invalid or has expired. Reset links can only
              be used once and time out after a while.
            </p>
            <Link
              href="/reset-password"
              className="text-center text-sm font-semibold text-fv-accent-strong"
            >
              Request a new link
            </Link>
          </div>
        ) : (
          <form
            action={updatePasswordAction}
            className="flex flex-col gap-4 rounded-xl bg-fv-bg-card p-6 shadow-sm"
          >
            <p className="text-sm text-fv-text-secondary">
              Setting a new password for {user.email}.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">
                New password
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">
                Confirm new password
              </span>
              <input
                type="password"
                name="confirm"
                required
                minLength={8}
                autoComplete="new-password"
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
              Save new password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

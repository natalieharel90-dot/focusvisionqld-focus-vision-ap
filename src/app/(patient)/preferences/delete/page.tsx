import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requestAccountDeletionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: { done?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  if (searchParams.done) {
    return (
      <main className="flex flex-col gap-4 px-5 py-6">
        <section className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-fv-accent to-fv-accent-strong px-5 py-9 text-center text-white shadow-sm">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h1 className="mt-4 text-2xl font-bold">Request received</h1>
          <p className="mt-1.5 text-sm text-white/85">
            Our team will be in touch to confirm the next steps.
          </p>
        </section>
        <p className="text-center text-sm text-fv-text-secondary">
          Your clinical records are kept for the period required by law. The
          rest of your account will be removed once your request is processed.
        </p>
        <Link
          href="/preferences"
          className="rounded-2xl bg-fv-accent-strong px-4 py-4 text-center text-base font-bold text-white hover:opacity-95"
        >
          Back to settings
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <Link
        href="/preferences"
        className="text-sm font-semibold text-fv-text-secondary"
      >
        ‹ Settings
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          Delete my account
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Request that your Recovery Companion account be removed
        </p>
      </header>

      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="font-semibold text-fv-text-primary">
          What happens when you request this
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-fv-text-secondary">
          {[
            "Your care team is notified and will confirm the request with you.",
            "Your app access, preferences, and messages are removed.",
            "Clinical records (your procedure, check-ins and notes) are retained for the period required by Australian health law — they cannot be deleted early.",
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fv-accent" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <form
        action={requestAccountDeletionAction}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold uppercase tracking-wide text-fv-text-secondary">
            Reason (optional)
          </span>
          <textarea
            name="reason"
            rows={3}
            placeholder="Anything you'd like the team to know"
            className="w-full rounded-2xl border border-fv-border bg-fv-bg-card px-4 py-3 text-sm text-fv-text-primary placeholder:text-fv-text-secondary"
          />
        </label>
        <button
          type="submit"
          className="rounded-2xl bg-red-600 px-4 py-4 text-base font-bold text-white hover:opacity-95"
        >
          Request account deletion
        </button>
      </form>
    </main>
  );
}

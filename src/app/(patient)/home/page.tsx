import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor(
    (Date.now() - new Date(`${dateStr}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

export default async function PatientHomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already redirected if no user; this is just for narrowing.
  if (!user) return null;

  const { data: procedure } = await supabase
    .from("procedures")
    .select("procedure_type, surgery_date")
    .eq("patient_id", user.id)
    .eq("status", "active")
    .order("surgery_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const day = daysSince(procedure?.surgery_date ?? null);

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-fv-text-secondary">
          {procedure
            ? `Day ${day ?? "?"} of recovery · ${procedure.procedure_type.toUpperCase()}`
            : "Welcome"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-fv-text-primary">
          Good day
        </h1>
        <p className="mt-2 text-sm text-fv-text-secondary">
          Your daily check-in only takes a minute. Tap below when you&apos;re
          ready.
        </p>
        <Link
          href="/check-in"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-fv-accent-strong px-4 py-3 text-sm font-semibold text-white"
        >
          Start today&apos;s check-in →
        </Link>
      </section>
    </main>
  );
}

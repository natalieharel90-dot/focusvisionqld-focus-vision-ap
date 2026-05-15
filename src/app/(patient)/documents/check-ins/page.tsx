import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sortCheckInsNewestFirst } from "@/lib/documents";

export const dynamic = "force-dynamic";

const ZONE_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  orange: "bg-orange-500",
};

const ZONE_LABEL: Record<string, string> = {
  green: "On track",
  yellow: "Keep an eye on it",
  orange: "Contact the clinic",
};

function capitalise(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function CheckInHistoryPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select(
      "id, recovery_day, vision, pain, light_sensitivity, unusual_symptoms, other_description, patient_zone, created_at"
    )
    .eq("patient_id", user.id);

  const ordered = sortCheckInsNewestFirst(checkIns ?? []);

  // Audit the view (spec §5.6 — document/record views are logged).
  await supabase.rpc("record_patient_audit_event", {
    p_event_type: "patient.checkin_history_viewed",
    p_entity_type: "check_in_history",
    p_new_value: { count: ordered.length },
  });

  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <Link href="/documents" className="text-sm text-fv-accent-strong">
        ‹ Back to documents
      </Link>
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Check-in history
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Every daily check-in you&apos;ve completed, newest first.
        </p>
      </header>

      {ordered.length === 0 ? (
        <div className="rounded-2xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          You haven&apos;t completed any check-ins yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl bg-fv-bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-fv-text-primary">
                  Day {c.recovery_day} · {fmtDate(c.created_at)}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-fv-text-secondary">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${
                      ZONE_DOT[c.patient_zone] ?? "bg-fv-text-muted"
                    }`}
                  />
                  {ZONE_LABEL[c.patient_zone] ?? c.patient_zone}
                </span>
              </div>
              <p className="mt-2 text-sm text-fv-text-secondary">
                Vision: {capitalise(c.vision)} · Pain {c.pain}/5 · Light
                sensitivity {c.light_sensitivity}/5
              </p>
              {c.unusual_symptoms.length > 0 ? (
                <p className="mt-1 text-sm text-fv-text-secondary">
                  Symptoms: {c.unusual_symptoms.join(", ")}
                </p>
              ) : null}
              {c.other_description ? (
                <p className="mt-1 text-sm text-fv-text-muted">
                  &ldquo;{c.other_description}&rdquo;
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

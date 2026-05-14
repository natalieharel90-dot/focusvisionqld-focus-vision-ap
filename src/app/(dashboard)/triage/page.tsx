import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";
import {
  markCheckInReviewedAction,
  resolveManualFlagAction,
} from "./actions";

export const dynamic = "force-dynamic";

type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"];
type ManualFlag = Database["public"]["Tables"]["manual_flags"]["Row"];

type AlertLevel = "yellow" | "orange" | "red";

type TriageItem = {
  level: AlertLevel;
  // Distinguishes which underlying row + action applies.
  kind: "check_in" | "manual_flag";
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string | null;
  recovery_day: number | null;
  thread_id: string | null;
  // The "firing rule(s)" / rationale text shown on the card.
  rationale: string;
  // ISO timestamp for sorting.
  raised_at: string;
};

const TIER_ORDER: ReadonlyArray<AlertLevel> = ["red", "orange", "yellow"];

const TIER_STYLES: Record<
  AlertLevel,
  { container: string; label: string; chip: string }
> = {
  red: {
    container: "bg-red-50 border-red-200",
    label: "text-red-900",
    chip: "bg-red-600 text-white",
  },
  orange: {
    container: "bg-orange-50 border-orange-200",
    label: "text-orange-900",
    chip: "bg-orange-500 text-white",
  },
  yellow: {
    container: "bg-yellow-50 border-yellow-200",
    label: "text-yellow-900",
    chip: "bg-yellow-500 text-yellow-950",
  },
};

function daysSince(surgeryDate: string | null): number | null {
  if (!surgeryDate) return null;
  return Math.floor(
    (Date.now() - new Date(`${surgeryDate}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function rationaleFromCheckIn(c: CheckIn): string {
  const bits: string[] = [];
  if (c.pain >= 2) bits.push(`Pain ${c.pain}`);
  if (c.light_sensitivity >= 3)
    bits.push(`Light sensitivity ${c.light_sensitivity}`);
  if (c.vision === "worse") bits.push("Vision worse");
  if (c.unusual_symptoms.length > 0)
    bits.push(`Symptoms: ${c.unusual_symptoms.join(", ")}`);
  if (c.other_description)
    bits.push(`"${c.other_description.slice(0, 80)}"`);
  return bits.length > 0
    ? bits.join(" · ")
    : `Routed ${c.staff_alert_level} by the engine`;
}

export default async function TriagePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();

  // Open check-ins (engine-routed) and unresolved manual flags.
  const [checkInsResult, manualFlagsResult] = await Promise.all([
    supabase
      .from("check_ins")
      .select("*")
      .in("staff_alert_level", ["yellow", "orange", "red"])
      .is("reviewed_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("manual_flags")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const checkIns = (checkInsResult.data ?? []) as CheckIn[];
  const manualFlags = (manualFlagsResult.data ?? []) as ManualFlag[];

  const patientIds = Array.from(
    new Set([
      ...checkIns.map((c) => c.patient_id),
      ...manualFlags.map((f) => f.patient_id),
    ])
  );

  const [patientsResult, proceduresResult, threadsResult] =
    patientIds.length > 0
      ? await Promise.all([
          supabase
            .from("patients")
            .select("id, name, phone")
            .in("id", patientIds),
          supabase
            .from("procedures")
            .select("patient_id, surgery_date, status")
            .in("patient_id", patientIds)
            .eq("status", "active"),
          supabase
            .from("message_threads")
            .select("id, patient_id")
            .in("patient_id", patientIds),
        ])
      : [
          { data: [] as { id: string; name: string; phone: string | null }[] },
          {
            data: [] as {
              patient_id: string;
              surgery_date: string;
              status: string;
            }[],
          },
          { data: [] as { id: string; patient_id: string }[] },
        ];

  const patientById = new Map(
    (patientsResult.data ?? []).map((p) => [p.id, p])
  );
  const surgeryDateByPatient = new Map(
    (proceduresResult.data ?? []).map((p) => [p.patient_id, p.surgery_date])
  );
  const threadIdByPatient = new Map(
    (threadsResult.data ?? []).map((t) => [t.patient_id, t.id])
  );

  const items: TriageItem[] = [];
  for (const c of checkIns) {
    if (c.staff_alert_level === "none") continue;
    const p = patientById.get(c.patient_id);
    items.push({
      level: c.staff_alert_level as AlertLevel,
      kind: "check_in",
      id: c.id,
      patient_id: c.patient_id,
      patient_name: p?.name ?? "Unknown",
      patient_phone: p?.phone ?? null,
      recovery_day: c.recovery_day,
      thread_id: threadIdByPatient.get(c.patient_id) ?? null,
      rationale: rationaleFromCheckIn(c),
      raised_at: c.created_at,
    });
  }
  for (const f of manualFlags) {
    const p = patientById.get(f.patient_id);
    items.push({
      level: f.alert_level as AlertLevel,
      kind: "manual_flag",
      id: f.id,
      patient_id: f.patient_id,
      patient_name: p?.name ?? "Unknown",
      patient_phone: p?.phone ?? null,
      recovery_day: daysSince(surgeryDateByPatient.get(f.patient_id) ?? null),
      thread_id: threadIdByPatient.get(f.patient_id) ?? null,
      rationale: `🚩 Manual flag: ${f.reason}`,
      raised_at: f.created_at,
    });
  }

  const byTier: Record<AlertLevel, TriageItem[]> = {
    red: [],
    orange: [],
    yellow: [],
  };
  for (const it of items) byTier[it.level].push(it);
  for (const tier of TIER_ORDER) {
    byTier[tier].sort((a, b) => (a.raised_at < b.raised_at ? 1 : -1));
  }

  const totalOpen = items.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between pb-6">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Triage queue
        </h1>
        <span className="text-sm text-fv-text-secondary">
          {totalOpen} open
        </span>
      </div>

      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {TIER_ORDER.map((level) => {
        const style = TIER_STYLES[level];
        const cards = byTier[level];
        return (
          <section key={level} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${style.chip}`}
              >
                {level}
              </span>
              <span className="text-xs text-fv-text-secondary">
                {cards.length} {cards.length === 1 ? "card" : "cards"}
              </span>
              {level === "red" ? (
                <span className="text-xs italic text-fv-text-secondary">
                  Patient sees Orange screen only
                </span>
              ) : null}
            </div>

            {cards.length === 0 ? (
              <p className="rounded-xl border border-dashed border-fv-bg-soft px-4 py-3 text-sm text-fv-text-secondary">
                No {level} cards.
              </p>
            ) : (
              <ul className="space-y-3">
                {cards.map((item) => (
                  <li
                    key={`${item.kind}:${item.id}`}
                    className={`rounded-xl border-2 p-4 ${style.container}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className={`text-base font-semibold ${style.label}`}>
                          {item.patient_name}
                          {item.recovery_day !== null ? (
                            <span className="ml-2 text-sm font-normal opacity-75">
                              Day {item.recovery_day}
                            </span>
                          ) : null}
                        </div>
                        <p className={`mt-1 text-sm ${style.label} opacity-90`}>
                          {item.rationale}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {level === "red" && item.patient_phone ? (
                        <a
                          href={`tel:${item.patient_phone}`}
                          className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white"
                        >
                          📞 Call NOW
                        </a>
                      ) : null}
                      {level !== "red" && item.patient_phone ? (
                        <a
                          href={`tel:${item.patient_phone}`}
                          className="rounded-md border border-fv-bg-soft bg-white px-3 py-1.5 text-xs font-semibold text-fv-text-primary"
                        >
                          📞 Call
                        </a>
                      ) : null}
                      {item.thread_id ? (
                        <Link
                          href={`/inbox/${item.thread_id}`}
                          className="rounded-md border border-fv-bg-soft bg-white px-3 py-1.5 text-xs font-semibold text-fv-text-primary"
                        >
                          💬 Message
                        </Link>
                      ) : null}
                      <Link
                        href={`/patients/${item.patient_id}`}
                        className="rounded-md border border-fv-bg-soft bg-white px-3 py-1.5 text-xs font-semibold text-fv-text-primary"
                      >
                        Open record
                      </Link>
                      <form
                        action={
                          item.kind === "check_in"
                            ? markCheckInReviewedAction
                            : resolveManualFlagAction
                        }
                        className="ml-auto"
                      >
                        <input
                          type="hidden"
                          name={
                            item.kind === "check_in" ? "check_in_id" : "flag_id"
                          }
                          value={item.id}
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-fv-accent-strong px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Mark resolved
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}

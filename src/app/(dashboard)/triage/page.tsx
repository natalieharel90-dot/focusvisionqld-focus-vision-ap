import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import type { Database } from "@/types/database.types";
import {
  markCheckInReviewedAction,
  resolveManualFlagAction,
} from "./actions";
import { TriageFilter } from "./TriageFilter";

export const dynamic = "force-dynamic";

type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"];
type ManualFlag = Database["public"]["Tables"]["manual_flags"]["Row"];
type AlertLevel = "yellow" | "orange" | "red";

type TriageItem = {
  level: AlertLevel;
  kind: "check_in" | "manual_flag";
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  recoveryDay: number | null;
  procedureType: string | null;
  surgeonName: string | null;
  threadId: string | null;
  detail: { label: string; text: string }[];
  raisedAt: string;
};

const TIER_ORDER: ReadonlyArray<AlertLevel> = ["red", "orange", "yellow"];

const TIER_META: Record<
  AlertLevel,
  {
    border: string;
    cardBg: string;
    pill: string;
    caption: string;
    avatar: string;
  }
> = {
  red: {
    border: "border-l-[#C13434]",
    cardBg: "bg-gradient-to-br from-[#FCEAEA] to-fv-bg-card",
    pill: "bg-[#C13434] text-white",
    caption: "Act immediately",
    avatar: "from-rose-400 to-red-600",
  },
  orange: {
    border: "border-l-[#D67E3B]",
    cardBg: "bg-fv-bg-card",
    pill: "bg-[#FFE5DA] text-[#B66828]",
    caption: "Contact today",
    avatar: "from-amber-400 to-orange-600",
  },
  yellow: {
    border: "border-l-[#D8A82A]",
    cardBg: "bg-fv-bg-card",
    pill: "bg-[#FFF6DF] text-[#9A7A14]",
    caption: "Review within 4h",
    avatar: "from-sky-400 to-emerald-600",
  },
};

function daysSince(surgeryDate: string | null): number | null {
  if (!surgeryDate) return null;
  return Math.floor(
    (Date.now() - Date.parse(`${surgeryDate}T00:00:00Z`)) / 86_400_000
  );
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

// The "Reported / Free text" detail lines for a check-in card.
function checkInDetail(c: CheckIn): { label: string; text: string }[] {
  const reported: string[] = [];
  reported.push(`Pain ${c.pain}/5`);
  reported.push(`Light sensitivity ${c.light_sensitivity}/5`);
  reported.push(`Vision "${c.vision}"`);
  if (c.unusual_symptoms.length > 0) {
    reported.push(`Symptoms: ${c.unusual_symptoms.join(", ")}`);
  }
  const lines = [{ label: "Reported", text: reported.join(" · ") }];
  if (c.other_description) {
    lines.push({ label: "Free text", text: `"${c.other_description}"` });
  }
  return lines;
}

export default async function TriagePage({
  searchParams,
}: {
  searchParams: { error?: string; filter?: string };
}) {
  const supabase = createSupabaseServerClient();
  const filter = searchParams.filter ?? "all";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [checkInsResult, manualFlagsResult, resolvedCheckInsResult, resolvedFlagsResult] =
    await Promise.all([
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
      supabase
        .from("check_ins")
        .select("id, patient_id, staff_alert_level, recovery_day, reviewed_by, reviewed_at")
        .in("staff_alert_level", ["yellow", "orange", "red"])
        .gte("reviewed_at", todayIso)
        .order("reviewed_at", { ascending: false }),
      supabase
        .from("manual_flags")
        .select("id, patient_id, alert_level, resolved_by_staff_id, resolved_at")
        .gte("resolved_at", todayIso)
        .order("resolved_at", { ascending: false }),
    ]);

  const checkIns = (checkInsResult.data ?? []) as CheckIn[];
  const manualFlags = (manualFlagsResult.data ?? []) as ManualFlag[];
  const resolvedCheckIns = resolvedCheckInsResult.data ?? [];
  const resolvedFlags = resolvedFlagsResult.data ?? [];

  const patientIds = Array.from(
    new Set([
      ...checkIns.map((c) => c.patient_id),
      ...manualFlags.map((f) => f.patient_id),
      ...resolvedCheckIns.map((c) => c.patient_id),
      ...resolvedFlags.map((f) => f.patient_id),
    ])
  );

  const [patientsResult, proceduresResult, threadsResult, staffResult] =
    patientIds.length > 0
      ? await Promise.all([
          supabase
            .from("patients")
            .select("id, name, phone")
            .in("id", patientIds),
          supabase
            .from("procedures")
            .select("patient_id, surgery_date, procedure_type, surgeon_id, status")
            .in("patient_id", patientIds)
            .eq("status", "active"),
          supabase
            .from("message_threads")
            .select("id, patient_id")
            .in("patient_id", patientIds),
          supabase.from("staff_users").select("id, name"),
        ])
      : [
          { data: [] as { id: string; name: string; phone: string | null }[] },
          {
            data: [] as {
              patient_id: string;
              surgery_date: string | null;
              procedure_type: string;
              surgeon_id: string;
              status: string;
            }[],
          },
          { data: [] as { id: string; patient_id: string }[] },
          { data: [] as { id: string; name: string }[] },
        ];

  const patientById = new Map(
    (patientsResult.data ?? []).map((p) => [p.id, p])
  );
  const procByPatient = new Map(
    (proceduresResult.data ?? []).map((p) => [p.patient_id, p])
  );
  const threadByPatient = new Map(
    (threadsResult.data ?? []).map((t) => [t.patient_id, t.id])
  );
  const staffName = new Map(
    (staffResult.data ?? []).map((s) => [s.id, s.name])
  );

  const items: TriageItem[] = [];
  for (const c of checkIns) {
    if (c.staff_alert_level === "none") continue;
    const p = patientById.get(c.patient_id);
    const proc = procByPatient.get(c.patient_id);
    items.push({
      level: c.staff_alert_level as AlertLevel,
      kind: "check_in",
      id: c.id,
      patientId: c.patient_id,
      patientName: p?.name ?? "Unknown",
      patientPhone: p?.phone ?? null,
      recoveryDay: c.recovery_day,
      procedureType: proc?.procedure_type ?? null,
      surgeonName: proc ? staffName.get(proc.surgeon_id) ?? null : null,
      threadId: threadByPatient.get(c.patient_id) ?? null,
      detail: checkInDetail(c),
      raisedAt: c.created_at,
    });
  }
  for (const f of manualFlags) {
    const p = patientById.get(f.patient_id);
    const proc = procByPatient.get(f.patient_id);
    items.push({
      level: f.alert_level as AlertLevel,
      kind: "manual_flag",
      id: f.id,
      patientId: f.patient_id,
      patientName: p?.name ?? "Unknown",
      patientPhone: p?.phone ?? null,
      recoveryDay: daysSince(proc?.surgery_date ?? null),
      procedureType: proc?.procedure_type ?? null,
      surgeonName: proc ? staffName.get(proc.surgeon_id) ?? null : null,
      threadId: threadByPatient.get(f.patient_id) ?? null,
      detail: [{ label: "Manual flag", text: f.reason }],
      raisedAt: f.created_at,
    });
  }

  const byTier: Record<AlertLevel, TriageItem[]> = {
    red: [],
    orange: [],
    yellow: [],
  };
  for (const it of items) byTier[it.level].push(it);
  for (const tier of TIER_ORDER) {
    byTier[tier].sort((a, b) => (a.raisedAt < b.raisedAt ? 1 : -1));
  }

  const resolvedToday = resolvedCheckIns.length + resolvedFlags.length;
  const needAttention = byTier.red.length + byTier.orange.length;

  const stats = [
    {
      label: "Red · urgent",
      value: byTier.red.length,
      sub: "Act immediately",
      cls: "border-l-4 border-l-[#C13434] bg-[#FCEAEA]",
      valueCls: "text-[#871A1A]",
    },
    {
      label: "Orange zone",
      value: byTier.orange.length,
      sub: "Contact today",
      cls: "border-l-4 border-l-[#D67E3B]",
      valueCls: "text-[#B66828]",
    },
    {
      label: "Yellow zone",
      value: byTier.yellow.length,
      sub: "Review within 4h",
      cls: "border-l-4 border-l-[#D8A82A]",
      valueCls: "text-[#9A7A14]",
    },
    {
      label: "Resolved today",
      value: resolvedToday,
      sub: "Cleared from the queue",
      cls: "",
      valueCls: "text-fv-text-primary",
    },
  ];

  // Recently-resolved feed.
  const resolvedFeed = [
    ...resolvedCheckIns.map((c) => ({
      key: `c:${c.id}`,
      patientId: c.patient_id,
      level: c.staff_alert_level as AlertLevel,
      day: c.recovery_day as number | null,
      by: c.reviewed_by ? staffName.get(c.reviewed_by) ?? null : null,
      at: c.reviewed_at as string,
    })),
    ...resolvedFlags.map((f) => ({
      key: `f:${f.id}`,
      patientId: f.patient_id,
      level: f.alert_level as AlertLevel,
      day: daysSince(procByPatient.get(f.patient_id)?.surgery_date ?? null),
      by: f.resolved_by_staff_id
        ? staffName.get(f.resolved_by_staff_id) ?? null
        : null,
      at: f.resolved_at as string,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const visibleTiers =
    filter === "all"
      ? TIER_ORDER
      : TIER_ORDER.filter((t) => t === filter);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fv-text-primary">
            Triage queue
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Patients flagged by today&apos;s check-ins — sorted by urgency.{" "}
            {needAttention} need attention.
          </p>
        </div>
        <TriageFilter value={filter} />
      </div>

      {searchParams.error ? (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl bg-fv-bg-card p-4 shadow-sm ${s.cls}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              {s.label}
            </div>
            <div className={`mt-1 text-2xl font-semibold ${s.valueCls}`}>
              {s.value}
            </div>
            <div className="text-xs text-fv-text-secondary">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tier sections */}
      {visibleTiers.map((tier) => {
        const meta = TIER_META[tier];
        const cards = byTier[tier];
        return (
          <section key={tier} className="mt-6">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className={`rounded-full px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-wide ${meta.pill}`}
              >
                {tier}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
                {meta.caption}
              </span>
              <span className="text-xs text-fv-text-secondary">
                · {cards.length} {cards.length === 1 ? "card" : "cards"}
              </span>
            </div>

            {cards.length === 0 ? (
              <p className="rounded-xl border border-dashed border-fv-bg-soft px-4 py-3 text-sm text-fv-text-secondary">
                No {tier} cards.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {cards.map((item) => (
                  <li
                    key={`${item.kind}:${item.id}`}
                    className={`rounded-xl border-l-[5px] p-4 shadow-sm ${meta.border} ${meta.cardBg}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        <span
                          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ${meta.avatar}`}
                        >
                          {initials(item.patientName)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-fv-text-primary">
                            {item.patientName}
                            {item.recoveryDay !== null
                              ? ` · Day ${item.recoveryDay}`
                              : ""}
                            {item.procedureType
                              ? ` ${item.procedureType.toUpperCase()}`
                              : ""}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-fv-text-secondary">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.pill}`}
                            >
                              {tier === "red"
                                ? "RED · URGENT"
                                : `${
                                    tier[0]!.toUpperCase() + tier.slice(1)
                                  } · ${meta.caption.toLowerCase()}`}
                            </span>
                            <span>
                              · Flagged {clockTime(item.raisedAt)} (
                              {ago(item.raisedAt)})
                            </span>
                            {item.surgeonName ? (
                              <span>· Surgeon: {item.surgeonName}</span>
                            ) : null}
                            {tier === "red" ? (
                              <strong className="text-[#871A1A]">
                                · Patient sees Orange screen only
                              </strong>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {item.patientPhone ? (
                          <a
                            href={`tel:${item.patientPhone}`}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                              tier === "red"
                                ? "bg-[#C13434] text-white"
                                : "border border-fv-border text-fv-text-primary hover:bg-fv-bg-soft"
                            }`}
                          >
                            {tier === "red" ? "📞 Call NOW" : "📞 Call"}
                          </a>
                        ) : null}
                        {item.threadId ? (
                          <Link
                            href={`/inbox?thread=${item.threadId}`}
                            className="rounded-md border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
                          >
                            💬 Message
                          </Link>
                        ) : null}
                        <Link
                          href={`/patients/${item.patientId}`}
                          className="rounded-md bg-fv-accent-strong px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          Open
                        </Link>
                        <form
                          action={
                            item.kind === "check_in"
                              ? markCheckInReviewedAction
                              : resolveManualFlagAction
                          }
                        >
                          <input
                            type="hidden"
                            name={
                              item.kind === "check_in"
                                ? "check_in_id"
                                : "flag_id"
                            }
                            value={item.id}
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
                          >
                            Resolve
                          </button>
                        </form>
                      </div>
                    </div>

                    <div
                      className={`mt-3 rounded-lg p-3 text-[13px] leading-relaxed text-fv-text-primary ${
                        tier === "red"
                          ? "border-l-[3px] border-l-[#C13434] bg-fv-bg-card"
                          : "bg-fv-bg-soft/60"
                      }`}
                    >
                      {item.detail.map((d) => (
                        <div key={d.label}>
                          <strong>{d.label}:</strong> {d.text}
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {/* Recently resolved */}
      <section className="mt-6 rounded-xl bg-fv-bg-soft/50 p-5">
        <h2 className="mb-2.5 text-[13px] font-semibold text-fv-text-secondary">
          Recently resolved (today)
        </h2>
        {resolvedFeed.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">
            Nothing resolved yet today.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-fv-bg-soft">
            {resolvedFeed.map((r) => {
              const p = patientById.get(r.patientId);
              return (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-fv-text-primary">
                      {p?.name ?? "Unknown patient"}
                      {r.day !== null ? ` · Day ${r.day}` : ""}
                    </div>
                    <div className="text-xs text-fv-text-secondary">
                      <span className="capitalize">{r.level}</span> → resolved
                      by {r.by ?? "staff"} · {clockTime(r.at)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    Resolved
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

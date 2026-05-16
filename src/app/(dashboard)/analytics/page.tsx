import Link from "next/link";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import {
  adherenceRate,
  canViewAnalytics,
  completionByRecoveryDay,
  completionRate,
  defaultAnalyticsRange,
  filterCheckIns,
  filterDoses,
  medianResponseHours,
  newPatientsOnboarded,
  procedureZoneHeatmap,
  surgeonStats,
  topSymptoms,
  zoneBreakdown,
  type AnalyticsFilters,
  type CheckInDailyRow,
  type CompletionRow,
  type DoseDailyRow,
  type MessageResponseRow,
  type OnboardingRow,
  type SymptomDailyRow,
} from "@/lib/analytics";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  CompletionChart,
  RecoveryCurveChart,
  type RecoveryCurvePoint,
} from "./AnalyticsCharts";
import { AnalyticsSettings } from "./AnalyticsSettings";
import { ANALYTICS_CARD_KEYS } from "./cards";
import { refreshAnalyticsAction } from "./actions";

export const dynamic = "force-dynamic";

// The standard procedures — a base list so they always appear even with
// no data. Any custom procedure the clinic adds is merged in at runtime.
const CANONICAL_PROCEDURES = ["lasik", "prk", "smile", "icl", "cataract"];

const CARD_LABELS: Record<string, string> = {
  total_patients: "Total patients onboarded",
  new_patients: "New patients",
  active_recoveries: "Active recoveries",
  app_active_rate: "App active rate",
  checkins_completed: "Check-ins completed",
  medication_adherence: "Medication adherence",
  median_response: "Median staff response",
  red_alert_rate: "Red alert rate",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

// The previous range of equal length, immediately before [from, to].
function previousRange(from: string, to: string) {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((t - f) / 86_400_000) + 1;
  const prevTo = f - 86_400_000;
  const prevFrom = prevTo - (days - 1) * 86_400_000;
  return {
    from: new Date(prevFrom).toISOString().slice(0, 10),
    to: new Date(prevTo).toISOString().slice(0, 10),
    days,
  };
}

function DeltaSub({ delta, days }: { delta: number; days: number }) {
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const cls =
    delta > 0
      ? "text-green-600"
      : delta < 0
        ? "text-red-600"
        : "text-fv-text-secondary";
  return (
    <span className={cls}>
      {arrow} {Math.abs(delta)} vs previous {days} days
    </span>
  );
}

const ZONE_STYLE: Record<string, { bar: string; text: string }> = {
  green: { bar: "bg-green-200", text: "text-green-800" },
  yellow: { bar: "bg-yellow-200", text: "text-yellow-800" },
  orange: { bar: "bg-orange-200", text: "text-orange-800" },
  red: { bar: "bg-red-300", text: "text-red-800" },
};

const FEEDBACK_TARGETS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "clinic", label: "Clinic care" },
  { key: "hospital", label: "Hospital experience" },
  { key: "app", label: "App experience" },
];

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-fv-text-primary">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-fv-text-secondary">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: me } = await supabase
    .from("staff_users")
    .select("access_tier, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canViewAnalytics(me?.access_tier, me?.role)) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          403 — Access denied
        </h1>
        <p className="mt-2 text-sm text-fv-text-secondary">
          Analytics is restricted to Owner / Admin / Clinical Lead and
          Surgeons.
        </p>
      </main>
    );
  }

  // ── Filters ──
  const def = defaultAnalyticsRange();
  const proceduresRaw = searchParams.procedures;
  const procedureTypes = Array.isArray(proceduresRaw)
    ? proceduresRaw
    : typeof proceduresRaw === "string" && proceduresRaw.length > 0
      ? proceduresRaw.split(",")
      : [];
  const filters: AnalyticsFilters = {
    from: first(searchParams.from) || def.from,
    to: first(searchParams.to) || def.to,
    procedureTypes,
  };
  const curveProc = first(searchParams.curve) ?? "all";
  const prev = previousRange(filters.from, filters.to);

  const [
    checkInsResult,
    dosesResult,
    completionResult,
    symptomsResult,
    responseResult,
    onboardingResult,
    totalPatientsResult,
    surgeonsResult,
    feedbackResult,
    proceduresResult,
    rawCheckInsResult,
    medsResult,
    rawDosesResult,
    targetsResult,
    layoutResult,
  ] = await Promise.all([
    supabase.from("mv_analytics_check_in_daily").select("*"),
    supabase.from("mv_analytics_dose_daily").select("*"),
    supabase.from("mv_analytics_checkin_completion").select("*"),
    supabase.from("mv_analytics_symptom_daily").select("*"),
    supabase.from("mv_analytics_message_response").select("*"),
    supabase.from("mv_analytics_onboarding").select("*"),
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("staff_users").select("id, name").eq("role", "surgeon"),
    supabase
      .from("feedback")
      .select("target, rating, patient_id")
      .gte("submitted_at", filters.from)
      .lte("submitted_at", `${filters.to}T23:59:59`),
    supabase
      .from("procedures")
      .select("patient_id, procedure_type, surgery_date, surgeon_id")
      .eq("status", "active"),
    supabase
      .from("check_ins")
      .select("recovery_day, patient_zone, staff_alert_level, patient_id, created_at"),
    supabase.from("medications").select("id, patient_id"),
    supabase
      .from("medication_doses")
      .select("medication_id, taken_at")
      .gte("scheduled_at", filters.from)
      .lte("scheduled_at", `${filters.to}T23:59:59`),
    supabase.from("analytics_targets").select("*").eq("id", true).maybeSingle(),
    supabase
      .from("staff_analytics_layout")
      .select("card_order")
      .eq("staff_id", user.id)
      .maybeSingle(),
  ]);

  const allCheckIns = (checkInsResult.data ??
    []) as unknown as CheckInDailyRow[];
  const allDoses = (dosesResult.data ?? []) as unknown as DoseDailyRow[];
  const completion = (completionResult.data ??
    []) as unknown as CompletionRow[];
  const symptoms = (symptomsResult.data ?? []) as unknown as SymptomDailyRow[];
  const responses = (responseResult.data ??
    []) as unknown as MessageResponseRow[];
  const onboarding = (onboardingResult.data ??
    []) as unknown as OnboardingRow[];
  const surgeonName = new Map(
    (surgeonsResult.data ?? []).map((s) => [s.id, s.name])
  );
  const feedback = feedbackResult.data ?? [];
  const procedures = proceduresResult.data ?? [];
  const procByPatient = new Map(
    procedures.map((p) => [p.patient_id, p.procedure_type.toLowerCase()])
  );
  // Procedure types in play — the canonical set plus any custom procedure
  // the clinic has added, so every procedure-typed control stays in sync.
  const procedureTypeList = [
    ...new Set([
      ...CANONICAL_PROCEDURES,
      ...procedures.map((p) => p.procedure_type.toLowerCase()),
    ]),
  ].sort();
  const rawCheckIns = rawCheckInsResult.data ?? [];
  const medPatient = new Map(
    (medsResult.data ?? []).map((m) => [m.id, m.patient_id])
  );
  const rawDoses = rawDosesResult.data ?? [];

  const targets = {
    checkin_completion_pct: targetsResult.data?.checkin_completion_pct ?? 75,
    medication_adherence_pct:
      targetsResult.data?.medication_adherence_pct ?? 90,
    staff_response_hours: Number(
      targetsResult.data?.staff_response_hours ?? 4
    ),
    red_alert_rate_pct: targetsResult.data?.red_alert_rate_pct ?? 5,
  };

  // ── Compute ──
  const checkIns = filterCheckIns(allCheckIns, filters);
  const doses = filterDoses(allDoses, filters);
  const bd = zoneBreakdown(checkIns);
  const heatmap = procedureZoneHeatmap(checkIns);
  const surgeonStatById = new Map(
    surgeonStats(checkIns, doses).map((s) => [s.surgeon_id, s])
  );

  // Per-surgeon table — patients, adherence, avg patient rating, flag rate.
  const patientsBySurgeon = new Map<string, number>();
  const surgeonByPatient = new Map<string, string>();
  for (const p of procedures) {
    patientsBySurgeon.set(
      p.surgeon_id,
      (patientsBySurgeon.get(p.surgeon_id) ?? 0) + 1
    );
    surgeonByPatient.set(p.patient_id, p.surgeon_id);
  }
  const ratingBySurgeon = new Map<string, { sum: number; n: number }>();
  for (const f of feedback) {
    const sid = surgeonByPatient.get(f.patient_id);
    if (!sid) continue;
    const e = ratingBySurgeon.get(sid) ?? { sum: 0, n: 0 };
    e.sum += f.rating;
    e.n += 1;
    ratingBySurgeon.set(sid, e);
  }
  const surgeonRows = [...patientsBySurgeon.keys()]
    .map((sid) => {
      const stat = surgeonStatById.get(sid);
      const r = ratingBySurgeon.get(sid);
      return {
        surgeonId: sid,
        name: surgeonName.get(sid) ?? "Unknown surgeon",
        patients: patientsBySurgeon.get(sid) ?? 0,
        adherence: stat?.adherence ?? null,
        flagRate: stat?.flagRate ?? 0,
        avgRating: r && r.n > 0 ? r.sum / r.n : null,
      };
    })
    .sort((a, b) => b.patients - a.patients);

  const symptomList = topSymptoms(symptoms, filters);
  const symptomTotal = Math.max(
    1,
    symptomList.reduce((s, x) => s + x.occurrences, 0)
  );

  // New patients — current range vs the previous equal-length range.
  const newPatientsCur = newPatientsOnboarded(onboarding, filters);
  const newPatientsPrev = newPatientsOnboarded(onboarding, {
    from: prev.from,
    to: prev.to,
  });

  // Active recoveries — surgeries dated within each range.
  const inRange = (d: string | null, f: string, t: string) =>
    d != null && d >= f && d <= t;
  const activeCur = procedures.filter((p) =>
    inRange(p.surgery_date, filters.from, filters.to)
  ).length;
  const activePrev = procedures.filter((p) =>
    inRange(p.surgery_date, prev.from, prev.to)
  ).length;

  // App-active rate — share of active recoveries that checked in this week.
  const weekAgo = Date.now() - 7 * 86_400_000;
  const activeThisWeek = new Set(
    rawCheckIns
      .filter((c) => Date.parse(c.created_at) >= weekAgo)
      .map((c) => c.patient_id)
  ).size;
  const appActiveRate =
    activeCur > 0 ? Math.min(1, activeThisWeek / activeCur) : null;

  // Recovery curve — average check-in zone severity by recovery day.
  const severity = (zone: string, alert: string): number =>
    alert === "red" ? 3 : zone === "orange" ? 2 : zone === "yellow" ? 1 : 0;
  const curveByDay = new Map<number, { sum: number; n: number }>();
  for (const c of rawCheckIns) {
    if (curveProc !== "all" && procByPatient.get(c.patient_id) !== curveProc) {
      continue;
    }
    const e = curveByDay.get(c.recovery_day) ?? { sum: 0, n: 0 };
    e.sum += severity(c.patient_zone, c.staff_alert_level);
    e.n += 1;
    curveByDay.set(c.recovery_day, e);
  }
  const recoveryCurve: RecoveryCurvePoint[] = [...curveByDay.entries()]
    .map(([day, e]) => ({ day, score: e.sum / e.n }))
    .sort((a, b) => a.day - b.day);

  // Adherence by procedure — doses joined through medication → patient.
  const adhTally = new Map<string, { scheduled: number; taken: number }>();
  for (const d of rawDoses) {
    const pid = medPatient.get(d.medication_id);
    const proc = pid ? procByPatient.get(pid) : undefined;
    if (!proc) continue;
    const t = adhTally.get(proc) ?? { scheduled: 0, taken: 0 };
    t.scheduled += 1;
    if (d.taken_at) t.taken += 1;
    adhTally.set(proc, t);
  }
  const adherenceByProcedure = procedureTypeList.map((p) => {
    const t = adhTally.get(p);
    return {
      procedure: p,
      rate: t && t.scheduled > 0 ? t.taken / t.scheduled : null,
    };
  }).filter((x) => x.rate !== null);

  // Feedback.
  const ratingAvg = (rows: { rating: number }[]): number | null =>
    rows.length === 0
      ? null
      : rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  const overallRating = ratingAvg(feedback);
  const feedbackByTarget = FEEDBACK_TARGETS.map((t) => ({
    label: t.label,
    avg: ratingAvg(feedback.filter((f) => f.target === t.key)),
    count: feedback.filter((f) => f.target === t.key).length,
  })).filter((t) => t.avg !== null);

  const completionPct = completionRate(completion);
  const adherencePct = adherenceRate(doses);
  const responseHours = medianResponseHours(responses, filters);
  const redAlertRate = bd.total > 0 ? bd.red / bd.total : null;

  await recordStaffAudit(supabase, "analytics.viewed", {
    entity_type: "analytics",
    new_value: {
      from: filters.from,
      to: filters.to,
      procedure_types: filters.procedureTypes,
    },
  });

  const exportQs = new URLSearchParams();
  exportQs.set("from", filters.from);
  exportQs.set("to", filters.to);
  if (filters.procedureTypes.length > 0) {
    exportQs.set("procedures", filters.procedureTypes.join(","));
  }
  const exportLink = (chart: string) =>
    `/analytics/export?chart=${chart}&${exportQs.toString()}`;
  const curveLink = (c: string) => {
    const q = new URLSearchParams(exportQs);
    q.set("curve", c);
    return `/analytics?${q.toString()}`;
  };

  // ── Stat cards, keyed so the staff layout can reorder them ──
  const cardByKey: Record<
    string,
    { label: string; value: string; sub: React.ReactNode | null }
  > = {
    total_patients: {
      label: CARD_LABELS.total_patients!,
      value: String(totalPatientsResult.count ?? 0),
      sub: null,
    },
    new_patients: {
      label: CARD_LABELS.new_patients!,
      value: String(newPatientsCur),
      sub: <DeltaSub delta={newPatientsCur - newPatientsPrev} days={prev.days} />,
    },
    active_recoveries: {
      label: CARD_LABELS.active_recoveries!,
      value: String(activeCur),
      sub: <DeltaSub delta={activeCur - activePrev} days={prev.days} />,
    },
    app_active_rate: {
      label: CARD_LABELS.app_active_rate!,
      value: pct(appActiveRate),
      sub: "Checked in within 7 days",
    },
    checkins_completed: {
      label: CARD_LABELS.checkins_completed!,
      value: pct(completionPct),
      sub: `Target: ${targets.checkin_completion_pct}%`,
    },
    medication_adherence: {
      label: CARD_LABELS.medication_adherence!,
      value: pct(adherencePct),
      sub: `Target: ${targets.medication_adherence_pct}%`,
    },
    median_response: {
      label: CARD_LABELS.median_response!,
      value: responseHours == null ? "—" : `${responseHours.toFixed(1)}h`,
      sub: `Target: ≤ ${targets.staff_response_hours}h`,
    },
    red_alert_rate: {
      label: CARD_LABELS.red_alert_rate!,
      value: pct(redAlertRate),
      sub: `Target: ≤ ${targets.red_alert_rate_pct}%`,
    },
  };

  // Card order — the staff member's saved order, reconciled against the
  // canonical key list so a stale or partial saved order still works.
  const savedOrder = layoutResult.data?.card_order ?? null;
  const cardOrder = [
    ...new Set([
      ...(savedOrder ?? []).filter((k) =>
        (ANALYTICS_CARD_KEYS as readonly string[]).includes(k)
      ),
      ...ANALYTICS_CARD_KEYS,
    ]),
  ];

  const inputCls =
    "rounded-lg border border-fv-bg-soft bg-fv-bg-app px-3 py-2 text-sm focus:border-fv-accent focus:outline-none";

  const curveButtons: ReadonlyArray<{ key: string; label: string }> = [
    { key: "all", label: "All" },
    ...procedureTypeList.map((p) => ({ key: p, label: p.toUpperCase() })),
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fv-text-primary">
            Practice analytics
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Aggregated only — no patient names, no individual records.
            Pre-computed; refreshed nightly.
          </p>
        </div>
        <div className="flex gap-2">
          <AnalyticsSettings
            targets={targets}
            cardOrder={cardOrder}
            cardLabels={CARD_LABELS}
            qs={exportQs.toString()}
          />
          <form action={refreshAnalyticsAction}>
            <input type="hidden" name="qs" value={exportQs.toString()} />
            <button
              type="submit"
              className="rounded-lg border border-fv-border px-4 py-2 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
            >
              ↻ Refresh data
            </button>
          </form>
        </div>
      </div>

      {searchParams.refreshed ? (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Analytics data refreshed.
        </p>
      ) : null}
      {searchParams.error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {first(searchParams.error)}
        </p>
      ) : null}

      {/* Filter — modern card with pill-toggle procedures */}
      <form
        method="get"
        className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className={inputCls}
          />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Procedures
          </legend>
          <div className="flex flex-wrap items-center gap-1.5">
            {procedureTypeList.map((p) => (
              <label key={p} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="procedures"
                  value={p}
                  defaultChecked={filters.procedureTypes.includes(p)}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-secondary transition-colors hover:bg-fv-bg-soft peer-checked:border-fv-accent-strong peer-checked:bg-fv-accent-strong peer-checked:text-white">
                  {p.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Apply
          </button>
          <Link
            href="/analytics"
            className="rounded-lg border border-fv-border px-4 py-2 text-sm font-medium text-fv-text-primary hover:bg-fv-bg-soft"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Quick-view stat cards — order is the staff member's saved layout */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cardOrder.map((key) => {
          const c = cardByKey[key];
          if (!c) return null;
          return (
            <div
              key={key}
              className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
                {c.label}
              </div>
              <div className="mt-2 text-4xl font-semibold text-fv-text-primary">
                {c.value}
              </div>
              {c.sub ? (
                <div className="mt-1 text-xs text-fv-text-secondary">
                  {c.sub}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Recovery curve + Adherence by procedure */}
      <div className="mt-3 grid grid-cols-1 gap-3 min-[1100px]:grid-cols-2">
        <Panel
          title={`Recovery progress curve${
            curveProc === "all" ? "" : ` · ${curveProc.toUpperCase()}`
          }`}
          subtitle="Average check-in zone by recovery day. Lower curve = healthier."
          action={
            <div className="flex flex-wrap gap-1">
              {curveButtons.map((b) => (
                <Link
                  key={b.key}
                  href={curveLink(b.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    curveProc === b.key
                      ? "bg-fv-accent-strong text-white"
                      : "border border-fv-border text-fv-text-secondary hover:bg-fv-bg-soft"
                  }`}
                >
                  {b.label}
                </Link>
              ))}
            </div>
          }
        >
          <RecoveryCurveChart data={recoveryCurve} />
        </Panel>

        <Panel
          title="Adherence by procedure"
          subtitle="Doses taken vs scheduled, per procedure type."
        >
          {adherenceByProcedure.length === 0 ? (
            <p className="text-sm text-fv-text-secondary">
              No medication doses in the selected range.
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {adherenceByProcedure.map((a) => {
                const v = Math.round((a.rate ?? 0) * 100);
                return (
                  <li key={a.procedure}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold uppercase text-fv-text-primary">
                        {a.procedure}
                      </span>
                      <span className="font-semibold text-fv-text-primary">
                        {v}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-fv-bg-soft">
                      <div
                        className="h-full rounded-full bg-fv-accent-strong"
                        style={{ width: `${v}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Zone breakdown */}
      <div className="mt-3">
        <Panel
          title={`Zone breakdown · ${bd.total} check-in${
            bd.total === 1 ? "" : "s"
          } in range`}
        >
          <div className="grid grid-cols-4 gap-2">
            {(["green", "yellow", "orange", "red"] as const).map((z) => {
              const share =
                bd.total === 0 ? 0 : Math.round((bd[z] / bd.total) * 100);
              return (
                <div key={z} className="text-center">
                  <div
                    className={`rounded-lg py-2.5 text-base font-bold ${ZONE_STYLE[z]!.bar} ${ZONE_STYLE[z]!.text}`}
                  >
                    {share}%
                  </div>
                  <div className="mt-1 text-xs capitalize text-fv-text-secondary">
                    {z}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Most reported symptoms + Patient feedback */}
      <div className="mt-3 grid grid-cols-1 gap-3 min-[1100px]:grid-cols-2">
        <Panel
          title="Most reported symptoms"
          subtitle="In the selected range."
          action={
            <a
              href={exportLink("symptom-frequency")}
              className="text-xs font-semibold text-fv-accent-strong hover:underline"
            >
              Export CSV
            </a>
          }
        >
          {symptomList.length === 0 ? (
            <p className="text-sm text-fv-text-secondary">
              No symptoms reported in range.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {symptomList.map((s) => (
                <li
                  key={s.symptom}
                  className="flex items-center justify-between gap-3 rounded-xl bg-fv-bg-soft/50 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-fv-text-primary">
                    {s.symptom}
                  </span>
                  <span className="shrink-0 rounded-full bg-fv-bg-accent-soft px-2.5 py-1 text-xs font-bold text-fv-accent-strong">
                    {Math.round((s.occurrences / symptomTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Patient feedback over time">
          {feedback.length === 0 ? (
            <p className="text-sm text-fv-text-secondary">
              No feedback submitted in the selected range.
            </p>
          ) : (
            <>
              <div className="text-center">
                <div className="text-5xl font-semibold text-fv-accent-strong">
                  {overallRating!.toFixed(1)}
                </div>
                <div className="mt-1 text-xs text-fv-text-secondary">
                  average rating · across {feedback.length} submission
                  {feedback.length === 1 ? "" : "s"}
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-2 border-t border-fv-bg-soft pt-3">
                {feedbackByTarget.map((t) => (
                  <li
                    key={t.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-fv-text-primary">{t.label}</span>
                    <span className="font-semibold text-fv-accent-strong">
                      ★ {t.avg!.toFixed(1)}
                      <span className="ml-1 text-xs font-normal text-fv-text-secondary">
                        ({t.count})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      {/* Check-in completion + Procedure × zone map */}
      <div className="mt-3 grid grid-cols-1 gap-3 min-[1100px]:grid-cols-2">
        <Panel
          title="Check-in completion by recovery day"
          action={
            <a
              href={exportLink("completion-by-recovery-day")}
              className="text-xs font-semibold text-fv-accent-strong hover:underline"
            >
              Export CSV
            </a>
          }
        >
          <CompletionChart data={completionByRecoveryDay(completion)} />
        </Panel>

        <Panel title="Procedure × zone map">
          {heatmap.length === 0 ? (
            <p className="text-sm text-fv-text-secondary">
              No check-ins in range.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-fv-text-secondary">
                <tr>
                  <th className="py-1">Procedure</th>
                  {(["green", "yellow", "orange", "red"] as const).map((z) => (
                    <th key={z} className="py-1 capitalize">
                      {z}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.map((row) => (
                  <tr key={row.procedure_type}>
                    <td className="py-1 font-medium uppercase text-fv-text-primary">
                      {row.procedure_type}
                    </td>
                    {(["green", "yellow", "orange", "red"] as const).map(
                      (z) => (
                        <td key={z} className="py-1 pr-2">
                          <div
                            className={`rounded ${ZONE_STYLE[z]!.bar} px-2 py-1 text-center text-xs font-semibold ${ZONE_STYLE[z]!.text}`}
                            style={{ opacity: 0.4 + row[z] * 0.6 }}
                          >
                            {Math.round(row[z] * 100)}%
                          </div>
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Surgeon performance */}
      <div className="mt-3">
        <Panel
          title="Surgeon performance"
          action={
            <a
              href={exportLink("surgeons")}
              className="text-xs font-semibold text-fv-accent-strong hover:underline"
            >
              Export CSV
            </a>
          }
        >
          {surgeonRows.length === 0 ? (
            <p className="text-sm text-fv-text-secondary">
              No surgeons with active patients.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-fv-bg-soft text-xs uppercase tracking-wide text-fv-text-secondary">
                <tr>
                  <th className="py-2">Surgeon</th>
                  <th className="py-2 text-center">Patients</th>
                  <th className="py-2 text-center">Avg adherence</th>
                  <th className="py-2 text-center">Avg rating</th>
                  <th className="py-2 text-center">Flag rate</th>
                </tr>
              </thead>
              <tbody>
                {surgeonRows.map((s) => (
                  <tr
                    key={s.surgeonId}
                    className="border-b border-fv-bg-soft/60"
                  >
                    <td className="py-2 font-medium text-fv-text-primary">
                      {s.name}
                    </td>
                    <td className="py-2 text-center text-fv-text-primary">
                      {s.patients}
                    </td>
                    <td className="py-2 text-center font-semibold text-fv-accent-strong">
                      {pct(s.adherence)}
                    </td>
                    <td className="py-2 text-center font-semibold text-fv-accent-strong">
                      {s.avgRating == null
                        ? "—"
                        : `★ ${s.avgRating.toFixed(1)}`}
                    </td>
                    <td className="py-2 text-center text-fv-text-primary">
                      {pct(s.flagRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </main>
  );
}

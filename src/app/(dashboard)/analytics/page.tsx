import Link from "next/link";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import {
  adherenceOverTime,
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
  zoneOverTime,
  type AnalyticsFilters,
  type CheckInDailyRow,
  type CompletionRow,
  type DoseDailyRow,
  type MessageResponseRow,
  type OnboardingRow,
  type SymptomDailyRow,
} from "@/lib/analytics";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { refreshAnalyticsAction } from "./actions";

export const dynamic = "force-dynamic";

const PROCEDURE_TYPES = ["lasik", "prk", "smile", "icl", "cataract"];

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

const ZONE_BG: Record<string, string> = {
  green: "bg-green-200",
  yellow: "bg-yellow-200",
  orange: "bg-orange-200",
  red: "bg-red-300",
};

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

  // Defense in depth — middleware already 403s, re-check server-side.
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

  // ── Queries: materialized views + one aggregate count ──
  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

  const [
    checkInsResult,
    dosesResult,
    completionResult,
    symptomsResult,
    responseResult,
    onboardingResult,
    activeRecoveriesResult,
    surgeonsResult,
  ] = await Promise.all([
    supabase.from("mv_analytics_check_in_daily").select("*"),
    supabase.from("mv_analytics_dose_daily").select("*"),
    supabase.from("mv_analytics_checkin_completion").select("*"),
    supabase.from("mv_analytics_symptom_daily").select("*"),
    supabase.from("mv_analytics_message_response").select("*"),
    supabase.from("mv_analytics_onboarding").select("*"),
    supabase
      .from("procedures")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("surgery_date", ninetyDaysAgo.toISOString().slice(0, 10))
      .lte("surgery_date", today),
    supabase.from("staff_users").select("id, name").eq("role", "surgeon"),
  ]);

  // Materialized-view columns are typed nullable by the generator; the
  // view SQL produces non-null aggregates, so these casts are sound.
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

  // ── Apply filters, compute ──
  const checkIns = filterCheckIns(allCheckIns, filters);
  const doses = filterDoses(allDoses, filters);

  const bd = zoneBreakdown(checkIns);
  const kpis = {
    activeRecoveries: activeRecoveriesResult.count ?? 0,
    newPatients: newPatientsOnboarded(onboarding, filters),
    completion: completionRate(completion),
    adherence: adherenceRate(doses),
    responseHours: medianResponseHours(responses, filters),
    zoneBreakdown: bd,
  };

  const heatmap = procedureZoneHeatmap(checkIns);
  const surgeons = surgeonStats(checkIns, doses);

  // Self-audit: which actor viewed which range + filter combination.
  await recordStaffAudit(supabase, "analytics.viewed", {
    entity_type: "analytics",
    new_value: {
      from: filters.from,
      to: filters.to,
      procedure_types: filters.procedureTypes,
    },
  });

  // Export query string carrying the active filters.
  const exportQs = new URLSearchParams();
  exportQs.set("from", filters.from);
  exportQs.set("to", filters.to);
  if (filters.procedureTypes.length > 0) {
    exportQs.set("procedures", filters.procedureTypes.join(","));
  }
  const exportLink = (chart: string) =>
    `/analytics/export?chart=${chart}&${exportQs.toString()}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fv-text-primary">
            Practice analytics
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Aggregated only — no patient names, no individual records.
            Pre-computed; refreshed nightly.
          </p>
        </div>
        <form action={refreshAnalyticsAction}>
          <input type="hidden" name="qs" value={exportQs.toString()} />
          <button
            type="submit"
            className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-semibold text-fv-text-primary"
          >
            ↻ Refresh data
          </button>
        </form>
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

      {/* Filter bar */}
      <form
        method="get"
        className="mt-5 flex flex-wrap items-end gap-4 rounded-xl bg-fv-bg-card p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">To</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <fieldset className="flex flex-col gap-1 text-xs">
          <legend className="font-semibold text-fv-text-secondary">
            Procedures (none = all)
          </legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {PROCEDURE_TYPES.map((p) => (
              <label key={p} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  name="procedures"
                  value={p}
                  defaultChecked={filters.procedureTypes.includes(p)}
                />
                {p.toUpperCase()}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="submit"
          className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
        <Link
          href="/analytics"
          className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
        >
          Reset
        </Link>
      </form>

      {/* KPI strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Active recoveries" value={String(kpis.activeRecoveries)} />
        <Kpi label="New patients (range)" value={String(kpis.newPatients)} />
        <Kpi label="Check-in completion" value={pct(kpis.completion)} />
        <Kpi label="Medication adherence" value={pct(kpis.adherence)} />
        <Kpi
          label="Median staff response"
          value={
            kpis.responseHours == null
              ? "—"
              : `${kpis.responseHours.toFixed(1)}h`
          }
        />
        <div className="rounded-xl bg-fv-bg-card p-4 shadow-sm">
          <div className="text-xs text-fv-text-secondary">Zone breakdown</div>
          <div className="mt-2 flex gap-1">
            {(["green", "yellow", "orange", "red"] as const).map((z) => {
              const share =
                bd.total === 0 ? 0 : Math.round((bd[z] / bd.total) * 100);
              return (
                <div key={z} className="flex-1 text-center">
                  <div
                    className={`rounded ${ZONE_BG[z]} py-1 text-xs font-semibold`}
                  >
                    {share}%
                  </div>
                  <div className="mt-0.5 text-[10px] capitalize text-fv-text-secondary">
                    {z}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recharts grid */}
      <div className="mt-6">
        <AnalyticsCharts
          zoneOverTime={zoneOverTime(checkIns)}
          adherenceOverTime={adherenceOverTime(doses)}
          completionByRecoveryDay={completionByRecoveryDay(completion)}
          topSymptoms={topSymptoms(symptoms, filters)}
          exportBaseQs={exportQs.toString()}
        />
      </div>

      {/* Procedure × zone heatmap */}
      <section className="mt-6 rounded-xl bg-fv-bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fv-text-primary">
            Procedure × zone heatmap
          </h2>
          <a
            href={exportLink("procedure-zone")}
            className="text-xs font-semibold text-fv-accent-strong"
          >
            Export CSV
          </a>
        </div>
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
                  {(["green", "yellow", "orange", "red"] as const).map((z) => (
                    <td key={z} className="py-1 pr-2">
                      <div
                        className={`rounded ${ZONE_BG[z]} px-2 py-1 text-center text-xs font-semibold`}
                        style={{ opacity: 0.35 + row[z] * 0.65 }}
                      >
                        {Math.round(row[z] * 100)}%
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Per-surgeon comparison — small multiples */}
      <section className="mt-6 rounded-xl bg-fv-bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fv-text-primary">
            Per-surgeon comparison
          </h2>
          <a
            href={exportLink("surgeons")}
            className="text-xs font-semibold text-fv-accent-strong"
          >
            Export CSV
          </a>
        </div>
        {surgeons.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">
            No data for the selected range.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {surgeons.map((s) => (
              <div
                key={s.surgeon_id}
                className="rounded-lg bg-fv-bg-soft p-3"
              >
                <div className="text-sm font-medium text-fv-text-primary">
                  {surgeonName.get(s.surgeon_id) ?? "Unknown surgeon"}
                </div>
                <div className="mt-2 text-xs text-fv-text-secondary">
                  Adherence:{" "}
                  <span className="font-semibold text-fv-text-primary">
                    {pct(s.adherence)}
                  </span>
                </div>
                <div className="text-xs text-fv-text-secondary">
                  Zone-flag rate:{" "}
                  <span className="font-semibold text-fv-text-primary">
                    {pct(s.flagRate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-fv-bg-card p-4 shadow-sm">
      <div className="text-2xl font-semibold text-fv-text-primary">
        {value}
      </div>
      <div className="text-xs text-fv-text-secondary">{label}</div>
    </div>
  );
}

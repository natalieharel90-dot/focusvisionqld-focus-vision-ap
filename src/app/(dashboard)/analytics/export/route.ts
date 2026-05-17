import { NextResponse, type NextRequest } from "next/server";

import { recordStaffAudit } from "@/lib/audit";
import {
  adherenceOverTime,
  aggregatesToCsv,
  canViewAnalytics,
  completionByRecoveryDay,
  defaultAnalyticsRange,
  filterCheckIns,
  filterDoses,
  procedureZoneHeatmap,
  surgeonStats,
  topSymptoms,
  zoneOverTime,
  type AnalyticsFilters,
  type CheckInDailyRow,
  type CompletionRow,
  type DoseDailyRow,
  type SymptomDailyRow,
} from "@/lib/analytics";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// CSV export of a chart's *aggregate* data — never raw check-ins. The
// matviews carry no patient id or name, so nothing here can leak PII.
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { data: me } = await supabase
    .from("staff_users")
    .select("access_tier, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canViewAnalytics(me?.access_tier, me?.role)) {
    return new NextResponse("403 Forbidden", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const chart = sp.get("chart") ?? "";
  const def = defaultAnalyticsRange();
  const proceduresParam = sp.get("procedures");
  const filters: AnalyticsFilters = {
    from: sp.get("from") || def.from,
    to: sp.get("to") || def.to,
    procedureTypes: proceduresParam ? proceduresParam.split(",") : [],
  };

  let headers: string[] = [];
  let rows: unknown[][] = [];

  if (chart === "zone-over-time") {
    const { data } = await supabase
      .from("analytics_check_in_daily")
      .select("*");
    const series = zoneOverTime(
      filterCheckIns((data ?? []) as CheckInDailyRow[], filters)
    );
    headers = ["day", "green", "yellow", "orange", "red"];
    rows = series.map((p) => [p.day, p.green, p.yellow, p.orange, p.red]);
  } else if (chart === "adherence-over-time") {
    const { data } = await supabase
      .from("analytics_dose_daily")
      .select("*");
    const series = adherenceOverTime(
      filterDoses((data ?? []) as DoseDailyRow[], filters)
    );
    headers = ["day", "adherence_rate"];
    rows = series.map((p) => [p.day, p.rate]);
  } else if (chart === "completion-by-recovery-day") {
    const { data } = await supabase
      .from("analytics_checkin_completion")
      .select("*");
    const series = completionByRecoveryDay(
      (data ?? []) as CompletionRow[]
    );
    headers = ["recovery_day", "completion_rate"];
    rows = series.map((p) => [p.recovery_day, p.rate]);
  } else if (chart === "symptom-frequency") {
    const { data } = await supabase
      .from("analytics_symptom_daily")
      .select("*");
    const series = topSymptoms(
      (data ?? []) as SymptomDailyRow[],
      filters
    );
    headers = ["symptom", "occurrences"];
    rows = series.map((p) => [p.symptom, p.occurrences]);
  } else if (chart === "procedure-zone") {
    const { data } = await supabase
      .from("analytics_check_in_daily")
      .select("*");
    const series = procedureZoneHeatmap(
      filterCheckIns((data ?? []) as CheckInDailyRow[], filters)
    );
    headers = ["procedure_type", "green", "yellow", "orange", "red"];
    rows = series.map((r) => [
      r.procedure_type,
      r.green,
      r.yellow,
      r.orange,
      r.red,
    ]);
  } else if (chart === "surgeons") {
    const [ci, dd] = await Promise.all([
      supabase.from("analytics_check_in_daily").select("*"),
      supabase.from("analytics_dose_daily").select("*"),
    ]);
    const series = surgeonStats(
      filterCheckIns((ci.data ?? []) as CheckInDailyRow[], filters),
      filterDoses((dd.data ?? []) as DoseDailyRow[], filters)
    );
    // surgeon_id is a staff id — not patient PII.
    headers = ["surgeon_id", "adherence_rate", "zone_flag_rate"];
    rows = series.map((s) => [s.surgeon_id, s.adherence ?? "", s.flagRate]);
  } else {
    return new NextResponse("Unknown chart", { status: 400 });
  }

  const csv = aggregatesToCsv(headers, rows);

  await recordStaffAudit(supabase, "analytics.exported", {
    entity_type: "analytics",
    new_value: {
      chart,
      from: filters.from,
      to: filters.to,
      procedure_types: filters.procedureTypes,
      row_count: rows.length,
    },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="analytics-${chart}-${filters.from}_to_${filters.to}.csv"`,
    },
  });
}

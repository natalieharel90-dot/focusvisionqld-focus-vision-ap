// Pure analytics engine for the Practice analytics dashboard.
// Operates on materialized-view row shapes — no DB / React imports — so
// every KPI and chart series is directly unit-testable. Inputs carry
// aggregates only; nothing here ever sees a patient name or id.

export type FiredZone = "green" | "yellow" | "orange" | "red";

export type DateRange = { from: string; to: string }; // YYYY-MM-DD
export type AnalyticsFilters = DateRange & { procedureTypes: string[] };

export type CheckInDailyRow = {
  day: string;
  procedure_type: string;
  surgeon_id: string | null;
  patient_zone: "green" | "yellow" | "orange";
  staff_alert_level: "none" | "yellow" | "orange" | "red";
  check_in_count: number;
};
export type DoseDailyRow = {
  day: string;
  surgeon_id: string | null;
  scheduled_count: number;
  taken_count: number;
};
export type CompletionRow = {
  recovery_day: number;
  expected_count: number;
  submitted_count: number;
};
export type SymptomDailyRow = {
  day: string;
  symptom: string;
  occurrences: number;
};
export type MessageResponseRow = {
  day: string;
  response_seconds: number | null;
};
export type OnboardingRow = { created_day: string; status: string };

// Owner / Admin / Clinical Lead (tier 1) and Surgeons may view analytics.
// Reception (and other non-tier-1 roles) cannot.
export function canViewAnalytics(
  accessTier: number | null | undefined,
  role: string | null | undefined
): boolean {
  return accessTier === 1 || role === "surgeon";
}

export function defaultAnalyticsRange(now: Date = new Date()): DateRange {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function inRange(day: string, r: DateRange): boolean {
  return day >= r.from && day <= r.to;
}

// The flag a check-in fired: red comes from the staff alert level (the
// patient still sees Orange); otherwise it's the patient zone.
export function firedZone(row: {
  patient_zone: "green" | "yellow" | "orange";
  staff_alert_level: "none" | "yellow" | "orange" | "red";
}): FiredZone {
  return row.staff_alert_level === "red" ? "red" : row.patient_zone;
}

export function filterCheckIns(
  rows: ReadonlyArray<CheckInDailyRow>,
  filters: AnalyticsFilters
): CheckInDailyRow[] {
  return rows.filter(
    (r) =>
      inRange(r.day, filters) &&
      (filters.procedureTypes.length === 0 ||
        filters.procedureTypes.includes(r.procedure_type))
  );
}

export function filterDoses(
  rows: ReadonlyArray<DoseDailyRow>,
  filters: DateRange
): DoseDailyRow[] {
  return rows.filter((r) => inRange(r.day, filters));
}

// ── KPIs ──────────────────────────────────────────────────────────────────

export type ZoneBreakdown = Record<FiredZone, number> & { total: number };

export function zoneBreakdown(
  rows: ReadonlyArray<CheckInDailyRow>
): ZoneBreakdown {
  const out: ZoneBreakdown = {
    green: 0,
    yellow: 0,
    orange: 0,
    red: 0,
    total: 0,
  };
  for (const r of rows) {
    out[firedZone(r)] += r.check_in_count;
    out.total += r.check_in_count;
  }
  return out;
}

// % of scheduled doses marked taken.
export function adherenceRate(
  rows: ReadonlyArray<DoseDailyRow>
): number | null {
  let scheduled = 0;
  let taken = 0;
  for (const r of rows) {
    scheduled += r.scheduled_count;
    taken += r.taken_count;
  }
  if (scheduled === 0) return null;
  return taken / scheduled;
}

// % of expected check-ins that were submitted (recovery-day profile —
// not date-range sliced).
export function completionRate(
  rows: ReadonlyArray<CompletionRow>
): number | null {
  let expected = 0;
  let submitted = 0;
  for (const r of rows) {
    expected += r.expected_count;
    submitted += r.submitted_count;
  }
  if (expected === 0) return null;
  return submitted / expected;
}

// Median staff response time, in hours. Business-hours weighting is a
// future refinement — this is wall-clock median.
export function medianResponseHours(
  rows: ReadonlyArray<MessageResponseRow>,
  filters: DateRange
): number | null {
  const seconds = rows
    .filter((r) => inRange(r.day, filters) && r.response_seconds != null)
    .map((r) => r.response_seconds as number)
    .sort((a, b) => a - b);
  if (seconds.length === 0) return null;
  const mid = Math.floor(seconds.length / 2);
  const medianSec =
    seconds.length % 2 === 0
      ? (seconds[mid - 1]! + seconds[mid]!) / 2
      : seconds[mid]!;
  return medianSec / 3600;
}

export function newPatientsOnboarded(
  rows: ReadonlyArray<OnboardingRow>,
  filters: DateRange
): number {
  return rows.filter((r) => inRange(r.created_day, filters)).length;
}

// ── Chart series ───────────────────────────────────────────────────────────

export type ZoneOverTimePoint = {
  day: string;
} & Record<FiredZone, number>;

export function zoneOverTime(
  rows: ReadonlyArray<CheckInDailyRow>
): ZoneOverTimePoint[] {
  const byDay = new Map<string, ZoneOverTimePoint>();
  for (const r of rows) {
    let point = byDay.get(r.day);
    if (!point) {
      point = { day: r.day, green: 0, yellow: 0, orange: 0, red: 0 };
      byDay.set(r.day, point);
    }
    point[firedZone(r)] += r.check_in_count;
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.day < b.day ? -1 : 1
  );
}

export type AdherencePoint = { day: string; rate: number };

export function adherenceOverTime(
  rows: ReadonlyArray<DoseDailyRow>
): AdherencePoint[] {
  const byDay = new Map<string, { scheduled: number; taken: number }>();
  for (const r of rows) {
    const acc = byDay.get(r.day) ?? { scheduled: 0, taken: 0 };
    acc.scheduled += r.scheduled_count;
    acc.taken += r.taken_count;
    byDay.set(r.day, acc);
  }
  return Array.from(byDay.entries())
    .map(([day, acc]) => ({
      day,
      rate: acc.scheduled === 0 ? 0 : acc.taken / acc.scheduled,
    }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export type CompletionPoint = { recovery_day: number; rate: number };

export function completionByRecoveryDay(
  rows: ReadonlyArray<CompletionRow>
): CompletionPoint[] {
  return rows
    .filter((r) => r.recovery_day >= 1 && r.recovery_day <= 30)
    .map((r) => ({
      recovery_day: r.recovery_day,
      rate: r.expected_count === 0 ? 0 : r.submitted_count / r.expected_count,
    }))
    .sort((a, b) => a.recovery_day - b.recovery_day);
}

export type SymptomCount = { symptom: string; occurrences: number };

export function topSymptoms(
  rows: ReadonlyArray<SymptomDailyRow>,
  filters: DateRange,
  limit = 10
): SymptomCount[] {
  const bySymptom = new Map<string, number>();
  for (const r of rows) {
    if (!inRange(r.day, filters)) continue;
    bySymptom.set(
      r.symptom,
      (bySymptom.get(r.symptom) ?? 0) + r.occurrences
    );
  }
  return Array.from(bySymptom.entries())
    .map(([symptom, occurrences]) => ({ symptom, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limit);
}

export type ProcedureZoneCell = {
  procedure_type: string;
} & Record<FiredZone, number>;

// Rows = procedure types; values = % of that procedure's check-ins that
// fired each zone.
export function procedureZoneHeatmap(
  rows: ReadonlyArray<CheckInDailyRow>
): ProcedureZoneCell[] {
  const byProc = new Map<string, ZoneBreakdown>();
  for (const r of rows) {
    let bd = byProc.get(r.procedure_type);
    if (!bd) {
      bd = { green: 0, yellow: 0, orange: 0, red: 0, total: 0 };
      byProc.set(r.procedure_type, bd);
    }
    bd[firedZone(r)] += r.check_in_count;
    bd.total += r.check_in_count;
  }
  return Array.from(byProc.entries())
    .map(([procedure_type, bd]) => ({
      procedure_type,
      green: bd.total === 0 ? 0 : bd.green / bd.total,
      yellow: bd.total === 0 ? 0 : bd.yellow / bd.total,
      orange: bd.total === 0 ? 0 : bd.orange / bd.total,
      red: bd.total === 0 ? 0 : bd.red / bd.total,
    }))
    .sort((a, b) => (a.procedure_type < b.procedure_type ? -1 : 1));
}

export type SurgeonStat = {
  surgeon_id: string;
  adherence: number | null;
  flagRate: number; // % of check-ins that fired non-green
};

export function surgeonStats(
  checkIns: ReadonlyArray<CheckInDailyRow>,
  doses: ReadonlyArray<DoseDailyRow>
): SurgeonStat[] {
  const surgeonIds = new Set<string>();
  for (const r of checkIns) if (r.surgeon_id) surgeonIds.add(r.surgeon_id);
  for (const r of doses) if (r.surgeon_id) surgeonIds.add(r.surgeon_id);

  return Array.from(surgeonIds).map((id) => {
    const ci = checkIns.filter((r) => r.surgeon_id === id);
    const bd = zoneBreakdown(ci);
    const flagRate =
      bd.total === 0
        ? 0
        : (bd.yellow + bd.orange + bd.red) / bd.total;
    const adh = adherenceRate(doses.filter((r) => r.surgeon_id === id));
    return { surgeon_id: id, adherence: adh, flagRate };
  });
}

// ── CSV ────────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

// Generic aggregate-to-CSV. Callers pass only aggregate rows — never raw
// check-ins or anything carrying a patient name/id.
export function aggregatesToCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<unknown>>
): string {
  const head = headers.map(csvCell).join(",");
  const body = rows.map((r) => r.map(csvCell).join(","));
  return [head, ...body].join("\r\n");
}

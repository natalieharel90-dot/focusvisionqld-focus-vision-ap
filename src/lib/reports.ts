// Reports section — pure calculation helpers and report metadata. The
// server-side builders fetch rows and delegate the maths here so the
// numbers are unit-testable against hand-computed fixtures.

export type ReportType =
  | "monthly_activity"
  | "surgeon"
  | "compliance"
  | "cohort";

export const REPORT_TYPES: ReadonlyArray<{
  key: ReportType;
  label: string;
  description: string;
}> = [
  {
    key: "monthly_activity",
    label: "Monthly clinic activity",
    description:
      "Onboarding, check-ins, adherence, messaging and flags for a calendar month.",
  },
  {
    key: "surgeon",
    label: "Per-surgeon report",
    description:
      "Outcomes for one surgeon over a date range — adherence, zones, flag rate.",
  },
  {
    key: "compliance",
    label: "Compliance / audit summary",
    description:
      "Record edits, manual flags, data exports and admin actions for an audit window.",
  },
  {
    key: "cohort",
    label: "Patient cohort report",
    description:
      "One row per matching patient — for surgeon outcome studies.",
  },
];

export function isReportType(value: unknown): value is ReportType {
  return (
    value === "monthly_activity" ||
    value === "surgeon" ||
    value === "compliance" ||
    value === "cohort"
  );
}

// ── Maths ────────────────────────────────────────────────────────────────

export function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// Whole-percent of part / whole (0 when whole is 0).
export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// Medication adherence — taken vs scheduled doses. null when nothing was
// scheduled (distinct from 0%).
export function adherenceRate(
  taken: number,
  scheduled: number
): number | null {
  return scheduled > 0 ? Math.round((taken / scheduled) * 100) : null;
}

export type ZoneInput = { patient_zone: string; staff_alert_level: string };
export type ReportZone = "green" | "yellow" | "orange" | "red";

// A check-in's report zone: Red staff alert wins, else the patient zone.
export function reportZone(checkIn: ZoneInput): ReportZone {
  if (checkIn.staff_alert_level === "red") return "red";
  if (checkIn.patient_zone === "yellow") return "yellow";
  if (checkIn.patient_zone === "orange") return "orange";
  return "green";
}

export type ZoneDistribution = {
  green: number;
  yellow: number;
  orange: number;
  red: number;
  total: number;
};

export function zoneDistribution(
  checkIns: ReadonlyArray<ZoneInput>
): ZoneDistribution {
  const dist: ZoneDistribution = {
    green: 0,
    yellow: 0,
    orange: 0,
    red: 0,
    total: checkIns.length,
  };
  for (const c of checkIns) dist[reportZone(c)] += 1;
  return dist;
}

// Manual-flag rate normalised per 100 patient-recovery-days, 1 decimal.
export function flagRatePer100RecoveryDays(
  flagCount: number,
  totalRecoveryDays: number
): number {
  if (totalRecoveryDays <= 0) return 0;
  return Math.round((flagCount / totalRecoveryDays) * 100 * 10) / 10;
}

// "2h 15m" / "8m" / "—" — for message response times.
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

// ── Patient cohort filter ────────────────────────────────────────────────

export type CohortReportFilter = {
  procedures: string[]; // empty = any procedure
  surgeonIds: string[]; // empty = any surgeon
  surgeryFrom: string | null; // ISO yyyy-mm-dd
  surgeryTo: string | null;
  zone: string | null; // null / "any" = any current zone
};

export type CohortPatientInput = {
  procedureType: string | null;
  surgeonId: string | null;
  surgeryDate: string | null;
  zone: string | null; // current patient zone
};

export function matchesCohortReport(
  patient: CohortPatientInput,
  filter: CohortReportFilter
): boolean {
  if (!patient.surgeryDate) return false;
  if (
    filter.procedures.length > 0 &&
    (patient.procedureType === null ||
      !filter.procedures.includes(patient.procedureType))
  ) {
    return false;
  }
  if (
    filter.surgeonIds.length > 0 &&
    (patient.surgeonId === null ||
      !filter.surgeonIds.includes(patient.surgeonId))
  ) {
    return false;
  }
  if (filter.surgeryFrom && patient.surgeryDate < filter.surgeryFrom) {
    return false;
  }
  if (filter.surgeryTo && patient.surgeryDate > filter.surgeryTo) {
    return false;
  }
  if (
    filter.zone &&
    filter.zone !== "any" &&
    patient.zone !== filter.zone
  ) {
    return false;
  }
  return true;
}

// Notes surfaced in the rendered reports for deliberately-limited sections.
export const RLS_BLOCKED_NOTE =
  "RLS-blocked access attempts are not currently logged. A future schema " +
  "migration can add this if required for compliance audit purposes.";

export const RESPONSE_TIME_NOTE =
  "Median computed across all hours; a business-hours-only median is " +
  "available in a future report version.";

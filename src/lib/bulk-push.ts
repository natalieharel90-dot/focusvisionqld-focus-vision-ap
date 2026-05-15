// Bulk push to cohorts (spec §6.12) — pure logic shared by the dashboard
// Compose preview and the History views. Database fan-out (fire_bulk_push)
// re-implements the cohort filter in SQL; the SQL function bulk_push_cohort
// and selectCohort() here must stay in sync.

export type FlagStatus = "any" | "none" | "yellow" | "orange" | "red";
export type CheckInZone = "green" | "yellow" | "orange";
export type ZoneFilter = "any" | CheckInZone;
export type FlagLevel = "yellow" | "orange" | "red";

// The cohort filter — serialised to bulk_pushes.cohort_filter (jsonb).
export type CohortFilter = {
  procedures: string[]; // procedure_type values; empty = any
  surgeonIds: string[]; // empty = any
  recoveryDayMin: number | null;
  recoveryDayMax: number | null;
  surgeryDateFrom: string | null; // ISO yyyy-mm-dd
  surgeryDateTo: string | null; // ISO yyyy-mm-dd
  flagStatus: FlagStatus;
  lastCheckInZone: ZoneFilter;
};

export const EMPTY_COHORT_FILTER: CohortFilter = {
  procedures: [],
  surgeonIds: [],
  recoveryDayMin: null,
  recoveryDayMax: null,
  surgeryDateFrom: null,
  surgeryDateTo: null,
  flagStatus: "any",
  lastCheckInZone: "any",
};

// A patient candidate for cohort matching, built from the most-recent
// active procedure plus open-flag and last-check-in state.
export type CohortPatient = {
  id: string;
  name: string;
  procedureType: string | null;
  surgeonId: string | null;
  surgeryDate: string | null; // ISO yyyy-mm-dd of the active procedure
  openFlagLevels: FlagLevel[];
  lastCheckInZone: CheckInZone | null;
};

export type CohortHit = {
  patient: CohortPatient;
  recoveryDay: number;
};

// Access tier 1-2 (Owner/Admin/Clinical Lead equivalent) may send a push.
// Tier 3 (e.g. Reception) is view-only.
export const BULK_PUSH_SEND_MAX_TIER = 2;

export function canSendBulkPush(
  accessTier: number | null | undefined
): boolean {
  return typeof accessTier === "number" && accessTier <= BULK_PUSH_SEND_MAX_TIER;
}

// Whole days between two ISO yyyy-mm-dd dates (parsed as UTC midnight).
export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

// Recovery day = days since surgery. Day 0 = surgery day.
export function recoveryDay(surgeryDate: string, today: string): number {
  return daysBetween(surgeryDate, today);
}

// Does one patient match the cohort filter? The cohort is defined over a
// patient's most-recent active procedure — a patient with no active
// procedure never matches.
export function matchCohort(
  patient: CohortPatient,
  filter: CohortFilter,
  today: string
): boolean {
  if (!patient.surgeryDate || !patient.procedureType) return false;

  if (
    filter.procedures.length > 0 &&
    !filter.procedures.includes(patient.procedureType)
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

  const day = recoveryDay(patient.surgeryDate, today);
  if (filter.recoveryDayMin !== null && day < filter.recoveryDayMin) {
    return false;
  }
  if (filter.recoveryDayMax !== null && day > filter.recoveryDayMax) {
    return false;
  }

  if (
    filter.surgeryDateFrom !== null &&
    patient.surgeryDate < filter.surgeryDateFrom
  ) {
    return false;
  }
  if (
    filter.surgeryDateTo !== null &&
    patient.surgeryDate > filter.surgeryDateTo
  ) {
    return false;
  }

  if (filter.flagStatus === "none" && patient.openFlagLevels.length > 0) {
    return false;
  }
  if (
    (filter.flagStatus === "yellow" ||
      filter.flagStatus === "orange" ||
      filter.flagStatus === "red") &&
    !patient.openFlagLevels.includes(filter.flagStatus)
  ) {
    return false;
  }

  if (
    filter.lastCheckInZone !== "any" &&
    patient.lastCheckInZone !== filter.lastCheckInZone
  ) {
    return false;
  }

  return true;
}

// Every patient matching the filter, with their recovery day attached.
export function selectCohort(
  patients: CohortPatient[],
  filter: CohortFilter,
  today: string
): CohortHit[] {
  const hits: CohortHit[] = [];
  for (const patient of patients) {
    if (matchCohort(patient, filter, today)) {
      hits.push({
        patient,
        recoveryDay: recoveryDay(patient.surgeryDate as string, today),
      });
    }
  }
  return hits;
}

// Human-readable cohort label stored on bulk_pushes.cohort_summary, e.g.
// "14 LASIK patients · days 3–7".
export function cohortSummary(filter: CohortFilter, count: number): string {
  const proc =
    filter.procedures.length > 0 ? filter.procedures.join(" + ") : "all";
  let summary = `${count} ${proc} patient${count === 1 ? "" : "s"}`;

  const lo = filter.recoveryDayMin;
  const hi = filter.recoveryDayMax;
  if (lo !== null && hi !== null) summary += ` · days ${lo}–${hi}`;
  else if (lo !== null) summary += ` · day ${lo}+`;
  else if (hi !== null) summary += ` · up to day ${hi}`;

  return summary;
}

export type SchedulablePush = {
  id: string;
  scheduledAt: string; // ISO timestamp
  firedAt: string | null;
};

// Pushes that are due to fire: scheduled time reached and not yet fired.
// Mirrors the WHERE clause of fire_due_bulk_pushes().
export function selectDuePushes<T extends SchedulablePush>(
  pushes: T[],
  now: string | number | Date
): T[] {
  const nowMs = new Date(now).getTime();
  return pushes.filter(
    (p) => p.firedAt === null && new Date(p.scheduledAt).getTime() <= nowMs
  );
}

// Count of recipients who have opened their delivery.
export function countOpened(
  deliveries: ReadonlyArray<{ openedAt: string | null }>
): number {
  return deliveries.filter((d) => d.openedAt !== null).length;
}

// Open rate as a whole percentage (0 when nothing was reached).
export function openRate(reached: number, opened: number): number {
  return reached > 0 ? Math.round((opened / reached) * 100) : 0;
}

// Two-letter initials for a name, for the cohort preview avatars.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

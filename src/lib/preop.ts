// Pre-op information screen (spec §5.10) — pure helpers for the surgery
// countdown, pre-op content filtering, and the surgery-day text fallback.

// Whole days between two ISO yyyy-mm-dd dates (parsed as UTC midnight).
export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

// A patient is "pre-op" up to and including their surgery day. The day
// after surgery the Pre-op screen and tile are hidden.
export function isPreOp(
  surgeryDate: string | null | undefined,
  today: string
): boolean {
  return surgeryDate != null && surgeryDate >= today;
}

export function daysUntilSurgery(surgeryDate: string, today: string): number {
  return daysBetween(today, surgeryDate);
}

// Friendly countdown shown on the Pre-op screen and home tile.
export function surgeryCountdownLabel(
  surgeryDate: string,
  today: string
): string {
  const days = daysUntilSurgery(surgeryDate, today);
  if (days < 0) return "Surgery has passed";
  if (days === 0) return "Surgery today";
  if (days === 1) return "Surgery tomorrow";
  return `Surgery in ${days} days`;
}

// Clinic-wide fallback when no procedure_template surgery-day text is set.
export const DEFAULT_SURGERY_DAY_TEXT =
  "Arrive 30 minutes before your scheduled time. Wear loose comfortable " +
  "clothing. Don't drink anything after midnight unless your surgeon's " +
  "instructions say otherwise.";

// Standard practical pre-op checklist (spec §5.10). Informational only —
// patients don't tick these off.
export const PREOP_CHECKLIST: ReadonlyArray<string> = [
  "Stop wearing contact lenses 24 hours before surgery",
  "Don't drink anything after midnight unless your surgeon says otherwise",
  "Don't wear eye makeup, perfume or aftershave on the day",
  "Wear loose, comfortable clothing",
  "Arrange someone to drive you home",
  "Bring your sunglasses, photo ID and any paperwork",
];

// Pre-op content for a patient: items aimed at pre-op (or both) audiences,
// matching the patient's procedure (or with no procedure restriction).
export function selectPreopContent<
  T extends { procedures: string[]; audience: string },
>(items: ReadonlyArray<T>, procedureType: string | null): T[] {
  return items.filter(
    (item) =>
      (item.audience === "pre_op" || item.audience === "both") &&
      (item.procedures.length === 0 ||
        (procedureType !== null && item.procedures.includes(procedureType)))
  );
}

// "What to expect on surgery day" text, most-specific-wins:
//   1. the patient's own procedure_template (by source_template_id)
//   2. any template for the same procedure_type
//   3. the clinic-wide default
export function selectSurgeryDayText<
  T extends {
    id: string;
    procedure_type: string;
    surgery_day_text: string | null;
  },
>(
  templates: ReadonlyArray<T>,
  sourceTemplateId: string | null,
  procedureType: string | null,
  defaultText: string = DEFAULT_SURGERY_DAY_TEXT
): string {
  const own = templates.find(
    (t) => t.id === sourceTemplateId && t.surgery_day_text
  );
  if (own?.surgery_day_text) return own.surgery_day_text;

  const byProcedure = templates.find(
    (t) => t.procedure_type === procedureType && t.surgery_day_text
  );
  if (byProcedure?.surgery_day_text) return byProcedure.surgery_day_text;

  return defaultText;
}

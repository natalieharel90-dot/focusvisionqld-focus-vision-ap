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

// Per-procedure day-before checklists, derived from the clinic's official
// patient brochures. The shape and wording differ meaningfully between
// laser (stop contacts 7 days, no fasting), lens surgery (fast 6 hours,
// keep blood thinners), ICL (fast + iridotomy if hyperopic), and
// pterygium (allergy disclosure). The generic checklist is the fallback
// when we don't have a procedure-specific list.
const LASER_CHECKLIST: ReadonlyArray<string> = [
  "Stop wearing contact lenses 7 days before surgery (longer for hard lenses or ortho-K — your team will confirm)",
  "No eye makeup, perfume, or aftershave on surgery day",
  "Have a light meal 2 hours before — you don't need to fast",
  "Wear comfortable, loose-fitting clothes",
  "Arrange a driver — you cannot drive yourself home",
  "Plan for someone to be with you the first night",
  "Bring sunglasses for the trip home",
  "Bring your photo ID and any pre-op paperwork",
];

const LENS_CHECKLIST: ReadonlyArray<string> = [
  "Fast for 6 hours before surgery (no food, drink, or chewing gum). You can take your normal medications with a small sip of water.",
  "Do NOT stop blood-thinning medications — keep taking them, but let the team know",
  "If you have diabetes, ask the team about adjusting your tablets or insulin on surgery day",
  "No eye makeup, perfume, or aftershave on surgery day",
  "Wear comfortable, loose-fitting clothes",
  "Arrange a driver — you cannot drive yourself home",
  "Arrange someone to be with you overnight",
  "Bring sunglasses for the trip home",
  "Bring your photo ID and any pre-op paperwork",
];

const ICL_CHECKLIST: ReadonlyArray<string> = [
  "Stop wearing contact lenses 7 days before surgery",
  "Fast for 6 hours before surgery (no food, drink, or chewing gum). You can take your normal medications with a small sip of water.",
  "Do NOT stop blood-thinning medications — keep taking them, but let the team know",
  "If you have diabetes, ask the team about adjusting your tablets or insulin",
  "If you're long-sighted, you'll need a laser iridotomy at least one week BEFORE surgery — book this in if you haven't already",
  "No eye makeup, perfume, or aftershave on surgery day",
  "Wear comfortable, loose-fitting clothes",
  "Arrange a driver and someone to stay with you overnight",
  "Bring your photo ID and any pre-op paperwork",
];

const PTERYGIUM_CHECKLIST: ReadonlyArray<string> = [
  "If you've ever had a reaction to cephalosporin antibiotics (Keflex, Cefaclor, Kefazol) — tell the team. An antibiotic from this family is injected at the end of surgery.",
  "If you're allergic to Iodine (Betadine) or Chlorhexidine — tell the team.",
  "No eye makeup, perfume, or aftershave on surgery day",
  "Wear comfortable, loose-fitting clothes",
  "Arrange a driver — you cannot drive yourself home",
  "Bring sunglasses for the trip home",
  "Bring your photo ID and any pre-op paperwork",
];

// Generic fallback for procedures we haven't profiled, or when the
// procedure type can't be resolved.
export const PREOP_CHECKLIST: ReadonlyArray<string> = [
  "Avoid eye makeup, perfume, and aftershave on surgery day",
  "Arrange a driver — you cannot drive yourself home",
  "Wear comfortable, loose-fitting clothes",
  "Bring sunglasses for the trip home",
  "Bring your photo ID and any pre-op paperwork",
];

const CHECKLISTS_BY_PROCEDURE: Record<string, ReadonlyArray<string>> = {
  lasik: LASER_CHECKLIST,
  prk: LASER_CHECKLIST,
  clear: LASER_CHECKLIST,
  rle: LENS_CHECKLIST,
  cataract: LENS_CHECKLIST,
  icl: ICL_CHECKLIST,
  pterygium: PTERYGIUM_CHECKLIST,
};

// The procedure-specific checklist for the patient's upcoming procedure,
// or the generic fallback if we don't have one profiled.
export function getPreopChecklist(
  procedureType: string | null | undefined
): ReadonlyArray<string> {
  if (!procedureType) return PREOP_CHECKLIST;
  return CHECKLISTS_BY_PROCEDURE[procedureType.toLowerCase()] ?? PREOP_CHECKLIST;
}

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

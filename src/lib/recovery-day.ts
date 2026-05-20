// The patient's "day" runs 01:00 → 01:00 Australia/Brisbane (= 15:00 →
// 15:00 UTC, since Brisbane has no DST). All patient-facing "today" and
// "recovery day" computations use this same boundary so the check-in
// form, the home dashboard, and reminders agree.
//
// 01:00 was chosen so a patient checking in at 23:30 doesn't roll over
// at midnight to a fresh check-in — but by the time they wake up the
// next morning, today's check-in IS available.

const BRISBANE_TZ = "Australia/Brisbane";
const DAY_BOUNDARY_HOUR = 1; // 01:00 Brisbane local

// The patient's current Brisbane date (YYYY-MM-DD) with the 01:00
// boundary applied — so 00:30 still resolves to the previous day.
export function patientToday(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - DAY_BOUNDARY_HOUR * 60 * 60 * 1000);
  return shifted.toLocaleDateString("en-CA", { timeZone: BRISBANE_TZ });
}

// The patient's current day-since-surgery, using the 01:00 Brisbane
// boundary. Returns null if surgeryDate is missing or unparseable.
export function recoveryDay(
  surgeryDate: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!surgeryDate) return null;
  const today = Date.parse(`${patientToday(now)}T00:00:00+10:00`);
  const surgery = Date.parse(`${surgeryDate}T00:00:00+10:00`);
  if (Number.isNaN(today) || Number.isNaN(surgery)) return null;
  return Math.max(0, Math.floor((today - surgery) / 86_400_000));
}

// Start (inclusive) and end (inclusive) of the patient's current "day",
// as UTC Dates. Use this for queries like "did this patient check in
// today?" that filter by created_at.
export function patientDayBoundsUtc(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const date = patientToday(now);
  const start = new Date(`${date}T01:00:00+10:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

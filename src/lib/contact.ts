// Patient Contact clinic screen (spec §5.8) — pure helpers for which
// contact options to show and whether the clinic is currently closed.

export type ContactActionType =
  | "call"
  | "message"
  | "book"
  | "map"
  | "url"
  | "custom";

export type ContactOption = {
  id: string;
  label: string;
  subtitle: string | null;
  icon: string;
  action_type: ContactActionType;
  action_value: string | null;
  order_index: number;
  enabled: boolean;
  is_required: boolean;
};

// The contact options to render: every enabled option, plus any required
// option (e.g. "Call the clinic") even when disabled. Ordered by
// order_index.
export function visibleContactOptions<
  T extends { enabled: boolean; is_required: boolean; order_index: number },
>(options: ReadonlyArray<T>): T[] {
  return [...options]
    .filter((o) => o.enabled || o.is_required)
    .sort((a, b) => a.order_index - b.order_index);
}

// Per-weekday opening hours: [open, close] as 24h "HH:MM", or null = closed.
export type DayHours = readonly [string, string] | null;
export type OpeningHours = Record<string, DayHours>;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

// Is the clinic closed at `now`, evaluated in the clinic's timezone?
// Closed days (null hours) and times outside [open, close) count as
// after-hours.
export function isAfterHours(
  hours: OpeningHours,
  now: Date,
  timeZone: string
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  let hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "0";
  if (hourStr === "24") hourStr = "0"; // some runtimes render midnight as 24

  const dayKey = weekday.toLowerCase().slice(0, 3);
  const today = hours[dayKey];
  if (!today) return true;

  const current = Number(hourStr) * 60 + Number(minuteStr);
  return current < toMinutes(today[0]) || current >= toMinutes(today[1]);
}

// Weekdays in display order, paired with their short label.
const WEEKDAYS: ReadonlyArray<readonly [string, string]> = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

// "08:00" → "8AM"; "09:30" → "9:30AM".
export function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h ?? 0;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mins = m ?? 0;
  return mins === 0
    ? `${h12}${period}`
    : `${h12}:${String(mins).padStart(2, "0")}${period}`;
}

// "Mon–Fri 8AM–5PM · Sat 9AM–1PM" — runs of days with identical hours are
// collapsed; closed days are skipped.
export function summariseHours(hours: OpeningHours): string {
  type Run = { start: string; end: string; label: string };
  const runs: Run[] = [];
  let run: Run | null = null;

  for (const [key, short] of WEEKDAYS) {
    const day = hours[key];
    const label = day
      ? `${formatHour(day[0])}–${formatHour(day[1])}`
      : null;
    if (label && run && run.label === label) {
      run.end = short;
    } else {
      if (run) runs.push(run);
      run = label ? { start: short, end: short, label } : null;
    }
  }
  if (run) runs.push(run);

  return runs
    .map(
      (r) =>
        `${r.start === r.end ? r.start : `${r.start}–${r.end}`} ${r.label}`
    )
    .join(" · ");
}

// The Contact-hero tagline: the service-areas label (if set) prefixed onto
// the opening-hours summary. With no service areas it falls back to the
// hours alone — never a dangling separator.
export function contactHeroTagline(
  serviceAreas: string | null | undefined,
  hours: OpeningHours
): string {
  const summary = summariseHours(hours);
  const areas = serviceAreas?.trim();
  if (areas) return summary ? `${areas} · ${summary}` : areas;
  return summary;
}

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

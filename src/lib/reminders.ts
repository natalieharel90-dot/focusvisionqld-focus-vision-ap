// Pure helpers for the reminder scheduler. No DB or framework imports,
// so they stay unit-testable.

// Is the wall-clock time "HH:MM" inside the quiet-hours window
// [start, end)? The window may wrap past midnight (e.g. 22:00 → 07:00).
// "HH:MM" strings are zero-padded, so plain string comparison is correct.
export function inQuietHours(
  now: string,
  start: string,
  end: string
): boolean {
  if (!start || !end || start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

// Wall-clock parts in the clinic's timezone. Brisbane has no daylight
// saving, so this is a stable reference all year.
export function brisbaneNow(date: Date): {
  day: string; // YYYY-MM-DD
  time: string; // HH:MM
  hour: number; // 0–23
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  // Some engines render midnight as "24" — normalise to "00".
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
    hour: Number(hour),
  };
}

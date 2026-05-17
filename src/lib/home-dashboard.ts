// Pure helpers for the operational home dashboard (/(dashboard)). Kept
// free of DB / React imports so the KPI maths, severity ordering, the
// activity-feed filter and the business-hours median are unit-testable.

export type Severity = "red" | "orange" | "yellow";

const SEVERITY_RANK: Record<Severity, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
};

// Sorts priority rows: Red, then Orange, then Yellow; newest first within
// each tier.
export function sortPriorities<
  T extends { severity: Severity; raisedAt: string },
>(rows: ReadonlyArray<T>): T[] {
  return [...rows].sort((a, b) => {
    const tier = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (tier !== 0) return tier;
    return a.raisedAt < b.raisedAt ? 1 : -1;
  });
}

export type FlagBreakdown = {
  red: number;
  orange: number;
  yellow: number;
  total: number;
};

// Tallies a list of alert levels into red / orange / yellow counts.
// Anything that isn't one of those three (e.g. "none") is ignored.
export function flagBreakdown(
  levels: ReadonlyArray<string | null>
): FlagBreakdown {
  const b: FlagBreakdown = { red: 0, orange: 0, yellow: 0, total: 0 };
  for (const level of levels) {
    if (level === "red") b.red += 1;
    else if (level === "orange") b.orange += 1;
    else if (level === "yellow") b.yellow += 1;
    else continue;
    b.total += 1;
  }
  return b;
}

export function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// Brisbane is UTC+10 year-round (Queensland has no daylight saving).
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Minutes of overlap with clinic business hours (Mon–Fri 08:00–17:00
// Brisbane time) between two timestamps. Used for the message
// response-time KPI. Computed in the clinic timezone — not the server's —
// so the figure is correct on a UTC host.
export function businessMinutesBetween(
  startIso: string,
  endIso: string
): number {
  // Shift into "Brisbane-local" time: the shifted epoch's UTC getters
  // then read as Brisbane wall-clock values.
  const start = new Date(startIso).getTime() + BRISBANE_OFFSET_MS;
  const end = new Date(endIso).getTime() + BRISBANE_OFFSET_MS;
  if (!(end > start)) return 0;

  let total = 0;
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() <= end) {
    const day = cursor.getUTCDay(); // 0 = Sun … 6 = Sat
    if (day >= 1 && day <= 5) {
      const dayStart = cursor.getTime();
      const from = Math.max(start, dayStart + 8 * 60 * 60 * 1000);
      const to = Math.min(end, dayStart + 17 * 60 * 60 * 1000);
      if (to > from) total += (to - from) / 60_000;
    }
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return Math.round(total);
}

type ThreadMessage = {
  thread_id: string;
  sender_type: string;
  sent_at: string;
};

// Business-hours minutes from each patient message to the first staff
// reply after it, across every thread. Feeds the response-time KPI.
export function firstReplyBusinessMinutes(
  messages: ReadonlyArray<ThreadMessage>
): number[] {
  const byThread = new Map<string, ThreadMessage[]>();
  for (const m of messages) {
    const list = byThread.get(m.thread_id) ?? [];
    list.push(m);
    byThread.set(m.thread_id, list);
  }
  const gaps: number[] = [];
  for (const list of byThread.values()) {
    const sorted = [...list].sort(
      (a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at)
    );
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i]!.sender_type !== "patient") continue;
      const reply = sorted
        .slice(i + 1)
        .find((m) => m.sender_type === "staff");
      if (reply) {
        gaps.push(
          businessMinutesBetween(sorted[i]!.sent_at, reply.sent_at)
        );
      }
    }
  }
  return gaps;
}

// "45m" / "2.5h" — response-time display.
export function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

// ── Activity feed ──────────────────────────────────────────────────────────

// Audit event types worth surfacing on the home activity feed — meaningful
// clinical and patient activity, not routine staff navigation (signing in,
// viewing the audit log, opening analytics, changing settings).
export const ACTIVITY_FEED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "patient.created",
  "patient.activated",
  "patient.flag_raised",
  "patient.flag_resolved",
  "patient.appointment_scheduled",
  "patient.check_in_reviewed",
  "patient.note_added",
  "message.sent_to_patient",
]);

export function isActivityFeedEvent(eventType: string): boolean {
  return ACTIVITY_FEED_EVENT_TYPES.has(eventType);
}

export type ActivityTone = "info" | "success" | "warning" | "danger";

// The semantic tone of an activity-feed event, for its margin dot.
export function activityTone(eventType: string): ActivityTone {
  if (eventType === "patient.flag_raised") return "danger";
  if (eventType === "patient.flag_resolved") return "success";
  if (eventType === "patient.activated" || eventType === "patient.created") {
    return "success";
  }
  if (eventType === "patient.appointment_scheduled") return "warning";
  return "info";
}

// "2m ago" / "1:42 PM" / "Yesterday" / "14 May" — relative-ish timestamp.
export function relativeTime(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - Date.parse(iso);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

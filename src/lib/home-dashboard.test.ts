import { describe, expect, it } from "vitest";

import {
  activityTone,
  businessMinutesBetween,
  firstReplyBusinessMinutes,
  flagBreakdown,
  formatResponseTime,
  isActivityFeedEvent,
  median,
  sortPriorities,
  type Severity,
} from "./home-dashboard";

describe("sortPriorities", () => {
  it("orders Red, then Orange, then Yellow", () => {
    const rows: { severity: Severity; raisedAt: string }[] = [
      { severity: "yellow", raisedAt: "2026-05-16T09:00:00Z" },
      { severity: "red", raisedAt: "2026-05-16T08:00:00Z" },
      { severity: "orange", raisedAt: "2026-05-16T07:00:00Z" },
    ];
    expect(sortPriorities(rows).map((r) => r.severity)).toEqual([
      "red",
      "orange",
      "yellow",
    ]);
  });

  it("sorts newest first within a severity tier", () => {
    const rows: { severity: Severity; raisedAt: string }[] = [
      { severity: "red", raisedAt: "2026-05-16T08:00:00Z" },
      { severity: "red", raisedAt: "2026-05-16T11:00:00Z" },
      { severity: "red", raisedAt: "2026-05-16T09:30:00Z" },
    ];
    expect(sortPriorities(rows).map((r) => r.raisedAt)).toEqual([
      "2026-05-16T11:00:00Z",
      "2026-05-16T09:30:00Z",
      "2026-05-16T08:00:00Z",
    ]);
  });
});

describe("flagBreakdown", () => {
  it("counts each level and ignores non-flag levels", () => {
    const bd = flagBreakdown([
      "red",
      "orange",
      "orange",
      "yellow",
      "none",
      null,
    ]);
    expect(bd).toEqual({ red: 1, orange: 2, yellow: 1, total: 4 });
  });

  it("is all zeroes for an empty list", () => {
    expect(flagBreakdown([])).toEqual({
      red: 0,
      orange: 0,
      yellow: 0,
      total: 0,
    });
  });
});

describe("median", () => {
  it("returns the middle of an odd-length list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middle values of an even-length list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("returns null for an empty list", () => {
    expect(median([])).toBeNull();
  });
});

describe("businessMinutesBetween", () => {
  it("counts only the 08:00–17:00 window on a weekday", () => {
    // 06:00 → 12:00 on a Friday → counts 08:00–12:00 = 240 minutes.
    const start = new Date(2026, 4, 15, 6, 0).toISOString();
    const end = new Date(2026, 4, 15, 12, 0).toISOString();
    expect(businessMinutesBetween(start, end)).toBe(240);
  });

  it("excludes the weekend", () => {
    // Sat 09:00 → Sat 16:00 — entirely on a weekend → 0 minutes.
    const start = new Date(2026, 4, 16, 9, 0).toISOString();
    const end = new Date(2026, 4, 16, 16, 0).toISOString();
    expect(businessMinutesBetween(start, end)).toBe(0);
  });

  it("returns 0 when end is before start", () => {
    const a = new Date(2026, 4, 15, 12, 0).toISOString();
    const b = new Date(2026, 4, 15, 10, 0).toISOString();
    expect(businessMinutesBetween(a, b)).toBe(0);
  });
});

describe("firstReplyBusinessMinutes", () => {
  it("measures each patient message to the next staff reply", () => {
    // Friday: patient at 09:00, staff replies at 09:30 → 30 business min.
    const gaps = firstReplyBusinessMinutes([
      {
        thread_id: "t1",
        sender_type: "patient",
        sent_at: new Date(2026, 4, 15, 9, 0).toISOString(),
      },
      {
        thread_id: "t1",
        sender_type: "staff",
        sent_at: new Date(2026, 4, 15, 9, 30).toISOString(),
      },
    ]);
    expect(gaps).toEqual([30]);
  });

  it("ignores a patient message with no staff reply", () => {
    const gaps = firstReplyBusinessMinutes([
      {
        thread_id: "t1",
        sender_type: "patient",
        sent_at: new Date(2026, 4, 15, 9, 0).toISOString(),
      },
    ]);
    expect(gaps).toEqual([]);
  });
});

describe("isActivityFeedEvent", () => {
  it("includes meaningful clinical events", () => {
    expect(isActivityFeedEvent("patient.flag_raised")).toBe(true);
    expect(isActivityFeedEvent("patient.activated")).toBe(true);
    expect(isActivityFeedEvent("message.sent_to_patient")).toBe(true);
  });

  it("excludes routine staff navigation", () => {
    expect(isActivityFeedEvent("audit.viewed")).toBe(false);
    expect(isActivityFeedEvent("staff.signed_in")).toBe(false);
    expect(isActivityFeedEvent("analytics.viewed")).toBe(false);
    expect(isActivityFeedEvent("settings.routing_rules_updated")).toBe(false);
  });
});

describe("activityTone", () => {
  it("maps event types to a semantic tone", () => {
    expect(activityTone("patient.flag_raised")).toBe("danger");
    expect(activityTone("patient.flag_resolved")).toBe("success");
    expect(activityTone("patient.activated")).toBe("success");
    expect(activityTone("patient.appointment_scheduled")).toBe("warning");
    expect(activityTone("message.sent_to_patient")).toBe("info");
  });
});

describe("formatResponseTime", () => {
  it("shows minutes under an hour and hours above", () => {
    expect(formatResponseTime(45)).toBe("45m");
    expect(formatResponseTime(150)).toBe("2.5h");
    expect(formatResponseTime(null)).toBe("—");
  });
});

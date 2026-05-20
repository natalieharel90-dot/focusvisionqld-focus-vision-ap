import { describe, expect, it } from "vitest";

import {
  patientDayBoundsUtc,
  patientToday,
  recoveryDay,
} from "./recovery-day";

// Brisbane is UTC+10 year-round. 01:00 Brisbane = 15:00 UTC the prior day.

describe("patientToday — Brisbane day with 01:00 boundary", () => {
  it("23:30 Brisbane Wed counts as Wednesday", () => {
    // 23:30 Wed 2026-05-13 Brisbane = 13:30 UTC Wed
    expect(patientToday(new Date("2026-05-13T13:30:00Z"))).toBe("2026-05-13");
  });

  it("00:30 Brisbane Thu still counts as Wednesday (before 01:00)", () => {
    // 00:30 Thu 2026-05-14 Brisbane = 14:30 UTC Wed
    expect(patientToday(new Date("2026-05-13T14:30:00Z"))).toBe("2026-05-13");
  });

  it("01:00 Brisbane Thu flips to Thursday", () => {
    // 01:00 Thu 2026-05-14 Brisbane = 15:00 UTC Wed
    expect(patientToday(new Date("2026-05-13T15:00:00Z"))).toBe("2026-05-14");
  });

  it("02:00 Brisbane Thu is clearly Thursday", () => {
    expect(patientToday(new Date("2026-05-13T16:00:00Z"))).toBe("2026-05-14");
  });

  it("10:00 Brisbane Thu (when the old UTC boundary used to flip)", () => {
    // 10:00 Thu Brisbane = 00:00 UTC Thu
    expect(patientToday(new Date("2026-05-14T00:00:00Z"))).toBe("2026-05-14");
  });
});

describe("recoveryDay — days since surgery, 01:00 Brisbane boundary", () => {
  const surgery = "2026-05-10"; // Sunday

  it("returns null when surgeryDate is missing", () => {
    expect(recoveryDay(null)).toBeNull();
    expect(recoveryDay(undefined)).toBeNull();
    expect(recoveryDay("")).toBeNull();
  });

  it("never goes negative — pre-surgery is Day 0", () => {
    // A day before surgery Brisbane time
    expect(
      recoveryDay(surgery, new Date("2026-05-09T05:00:00Z"))
    ).toBe(0);
  });

  it("surgery day itself is Day 0", () => {
    // 09:00 Brisbane on surgery day
    expect(
      recoveryDay(surgery, new Date("2026-05-09T23:00:00Z"))
    ).toBe(0);
  });

  it("23:30 Brisbane on Day 3 reports Day 3", () => {
    // 23:30 Wed 2026-05-13 Brisbane = day 3 since surgery 2026-05-10
    expect(
      recoveryDay(surgery, new Date("2026-05-13T13:30:00Z"))
    ).toBe(3);
  });

  it("00:30 Brisbane Day 4 still reports Day 3 (before 01:00 boundary)", () => {
    // 00:30 Thu Brisbane = before the 01:00 flip
    expect(
      recoveryDay(surgery, new Date("2026-05-13T14:30:00Z"))
    ).toBe(3);
  });

  it("01:00 Brisbane Day 4 flips to Day 4", () => {
    expect(
      recoveryDay(surgery, new Date("2026-05-13T15:00:00Z"))
    ).toBe(4);
  });
});

describe("patientDayBoundsUtc", () => {
  it("the window starts at 01:00 Brisbane = 15:00 UTC prior day", () => {
    const { start, end } = patientDayBoundsUtc(
      new Date("2026-05-13T16:00:00Z") // 02:00 Brisbane Thu
    );
    expect(start.toISOString()).toBe("2026-05-13T15:00:00.000Z");
    // 24 hours minus 1ms later
    expect(end.toISOString()).toBe("2026-05-14T14:59:59.999Z");
  });

  it("just-before-01:00 Brisbane is still in the previous day's window", () => {
    const { start, end } = patientDayBoundsUtc(
      new Date("2026-05-13T14:45:00Z") // 00:45 Brisbane Thu
    );
    // Previous day = Wed 2026-05-13 — window starts 15:00 UTC Tue
    expect(start.toISOString()).toBe("2026-05-12T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-13T14:59:59.999Z");
  });
});

import { describe, expect, it } from "vitest";

import { inQuietHours } from "./reminders";

describe("inQuietHours", () => {
  it("treats an overnight window as wrapping past midnight", () => {
    expect(inQuietHours("23:00", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("03:00", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("12:00", "22:00", "07:00")).toBe(false);
  });

  it("handles a same-day window", () => {
    expect(inQuietHours("12:00", "09:00", "17:00")).toBe(true);
    expect(inQuietHours("08:00", "09:00", "17:00")).toBe(false);
    expect(inQuietHours("17:00", "09:00", "17:00")).toBe(false);
  });

  it("treats the start as inclusive and the end as exclusive", () => {
    expect(inQuietHours("22:00", "22:00", "07:00")).toBe(true);
    expect(inQuietHours("07:00", "22:00", "07:00")).toBe(false);
  });

  it("is never quiet when the window is empty or zero-length", () => {
    expect(inQuietHours("12:00", "10:00", "10:00")).toBe(false);
    expect(inQuietHours("12:00", "", "")).toBe(false);
  });
});

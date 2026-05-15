import { describe, expect, it } from "vitest";

import {
  DEFAULT_SURGERY_DAY_TEXT,
  PREOP_CHECKLIST,
  daysBetween,
  daysUntilSurgery,
  isPreOp,
  selectPreopContent,
  selectSurgeryDayText,
  surgeryCountdownLabel,
} from "./preop";

describe("daysBetween / daysUntilSurgery", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-05-15", "2026-05-27")).toBe(12);
    expect(daysUntilSurgery("2026-05-27", "2026-05-15")).toBe(12);
  });
});

describe("isPreOp — tile/route gating", () => {
  it.each<[string | null, string, boolean]>([
    ["2026-05-27", "2026-05-15", true], // surgery in future
    ["2026-05-15", "2026-05-15", true], // surgery day itself — still pre-op
    ["2026-05-14", "2026-05-15", false], // day after surgery — hidden
    [null, "2026-05-15", false], // no surgery date
  ])("surgery=%s today=%s → preOp=%s", (surgery, today, expected) => {
    expect(isPreOp(surgery, today)).toBe(expected);
  });
});

describe("surgeryCountdownLabel — updates daily", () => {
  const SURGERY = "2026-06-01";
  it.each<[string, string]>([
    ["2026-05-20", "Surgery in 12 days"],
    ["2026-05-30", "Surgery in 2 days"],
    ["2026-05-31", "Surgery tomorrow"],
    ["2026-06-01", "Surgery today"],
    ["2026-06-02", "Surgery has passed"],
  ])("today %s → %s", (today, expected) => {
    expect(surgeryCountdownLabel(SURGERY, today)).toBe(expected);
  });
});

describe("selectPreopContent — audience + procedure filter", () => {
  const items = [
    { id: "general", procedures: [] as string[], audience: "pre_op" },
    { id: "lasik", procedures: ["lasik"], audience: "pre_op" },
    { id: "prk", procedures: ["prk"], audience: "pre_op" },
    { id: "postop", procedures: [] as string[], audience: "post_op" },
    { id: "both", procedures: [] as string[], audience: "both" },
  ];

  it("a LASIK patient sees general + LASIK pre-op content", () => {
    expect(selectPreopContent(items, "lasik").map((i) => i.id)).toEqual([
      "general",
      "lasik",
      "both",
    ]);
  });

  it("excludes post-op-only content", () => {
    expect(
      selectPreopContent(items, "lasik").some((i) => i.id === "postop")
    ).toBe(false);
  });

  it("with no procedure, only unrestricted items show", () => {
    expect(selectPreopContent(items, null).map((i) => i.id)).toEqual([
      "general",
      "both",
    ]);
  });
});

describe("selectSurgeryDayText — most-specific-wins fallback", () => {
  it("uses the patient's own template when it has text", () => {
    const templates = [
      { id: "own", procedure_type: "lasik", surgery_day_text: "OWN" },
      { id: "x", procedure_type: "lasik", surgery_day_text: "GENERIC" },
    ];
    expect(selectSurgeryDayText(templates, "own", "lasik", "DEF")).toBe("OWN");
  });

  it("falls back to another template for the procedure", () => {
    const templates = [
      { id: "own", procedure_type: "lasik", surgery_day_text: null },
      { id: "x", procedure_type: "lasik", surgery_day_text: "GENERIC" },
    ];
    expect(selectSurgeryDayText(templates, "own", "lasik", "DEF")).toBe(
      "GENERIC"
    );
  });

  it("falls back to the procedure tier when there is no source template", () => {
    const templates = [
      { id: "x", procedure_type: "lasik", surgery_day_text: "GENERIC" },
    ];
    expect(selectSurgeryDayText(templates, null, "lasik", "DEF")).toBe(
      "GENERIC"
    );
  });

  it("falls back to the default when nothing matches", () => {
    const templates = [
      { id: "x", procedure_type: "prk", surgery_day_text: "PRK" },
    ];
    expect(selectSurgeryDayText(templates, "own", "lasik", "DEF")).toBe("DEF");
  });

  it("DEFAULT_SURGERY_DAY_TEXT is a non-empty fallback", () => {
    expect(DEFAULT_SURGERY_DAY_TEXT.length).toBeGreaterThan(0);
    expect(selectSurgeryDayText([], null, "lasik")).toBe(
      DEFAULT_SURGERY_DAY_TEXT
    );
  });
});

describe("PREOP_CHECKLIST", () => {
  it("is a non-empty list of practical tasks", () => {
    expect(PREOP_CHECKLIST.length).toBeGreaterThanOrEqual(4);
  });
});

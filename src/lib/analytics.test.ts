import { describe, expect, it } from "vitest";

import {
  adherenceOverTime,
  adherenceRate,
  aggregatesToCsv,
  canViewAnalytics,
  completionByRecoveryDay,
  completionRate,
  filterCheckIns,
  filterDoses,
  firedZone,
  medianResponseHours,
  newPatientsOnboarded,
  procedureZoneHeatmap,
  surgeonStats,
  topSymptoms,
  zoneBreakdown,
  zoneOverTime,
  type AnalyticsFilters,
  type CheckInDailyRow,
  type DoseDailyRow,
} from "./analytics";

// ── Hand-computed seed-style dataset ──────────────────────────────────────
// 8 check-ins across 2 days, 2 procedures, 2 surgeons.
const CHECK_INS: CheckInDailyRow[] = [
  { day: "2026-05-10", procedure_type: "lasik", surgeon_id: "chen", patient_zone: "green", staff_alert_level: "none", check_in_count: 3 },
  { day: "2026-05-10", procedure_type: "lasik", surgeon_id: "chen", patient_zone: "yellow", staff_alert_level: "yellow", check_in_count: 1 },
  { day: "2026-05-10", procedure_type: "prk", surgeon_id: "nguyen", patient_zone: "orange", staff_alert_level: "orange", check_in_count: 1 },
  { day: "2026-05-11", procedure_type: "prk", surgeon_id: "nguyen", patient_zone: "orange", staff_alert_level: "red", check_in_count: 1 },
  { day: "2026-05-11", procedure_type: "lasik", surgeon_id: "chen", patient_zone: "green", staff_alert_level: "none", check_in_count: 2 },
  // out of the default range — should be excluded by filterCheckIns
  { day: "2026-01-01", procedure_type: "lasik", surgeon_id: "chen", patient_zone: "green", staff_alert_level: "none", check_in_count: 99 },
];

const RANGE: AnalyticsFilters = {
  from: "2026-05-01",
  to: "2026-05-31",
  procedureTypes: [],
};

describe("canViewAnalytics — role gate", () => {
  it("tier-1 (Owner/Admin/Clinical Lead) can view", () => {
    expect(canViewAnalytics(1, "nurse")).toBe(true);
  });
  it("a surgeon can view regardless of tier", () => {
    expect(canViewAnalytics(2, "surgeon")).toBe(true);
    expect(canViewAnalytics(3, "surgeon")).toBe(true);
  });
  it("Reception gets denied (→ 403)", () => {
    expect(canViewAnalytics(2, "reception")).toBe(false);
    expect(canViewAnalytics(3, "reception")).toBe(false);
  });
  it("a tier-2 nurse without surgeon role is denied", () => {
    expect(canViewAnalytics(2, "nurse")).toBe(false);
  });
});

describe("firedZone — red is staff-side", () => {
  it("staff_alert_level red ⇒ fired red even though patient saw orange", () => {
    expect(
      firedZone({ patient_zone: "orange", staff_alert_level: "red" })
    ).toBe("red");
  });
  it("otherwise the fired zone is the patient zone", () => {
    expect(
      firedZone({ patient_zone: "yellow", staff_alert_level: "yellow" })
    ).toBe("yellow");
  });
});

describe("date-range filter restricts the dataset", () => {
  it("excludes rows outside the range (the 2026-01-01 row drops out)", () => {
    const filtered = filterCheckIns(CHECK_INS, RANGE);
    expect(filtered).toHaveLength(5);
    expect(filtered.some((r) => r.day === "2026-01-01")).toBe(false);
  });

  it("a narrow range restricts further", () => {
    const filtered = filterCheckIns(CHECK_INS, {
      ...RANGE,
      from: "2026-05-11",
      to: "2026-05-11",
    });
    expect(filtered.every((r) => r.day === "2026-05-11")).toBe(true);
    expect(filtered).toHaveLength(2);
  });
});

describe("procedure filter narrows correctly", () => {
  it("only lasik rows when procedureTypes=[lasik]", () => {
    const filtered = filterCheckIns(CHECK_INS, {
      ...RANGE,
      procedureTypes: ["lasik"],
    });
    expect(filtered.every((r) => r.procedure_type === "lasik")).toBe(true);
    // 3 lasik rows are in range (the 99-count one is out of range)
    expect(filtered).toHaveLength(3);
  });

  it("empty procedureTypes means no procedure restriction", () => {
    expect(
      filterCheckIns(CHECK_INS, { ...RANGE, procedureTypes: [] })
    ).toHaveLength(5);
  });
});

describe("zoneBreakdown — hand-computed", () => {
  it("counts fired zones across in-range check-ins", () => {
    // In range: green 3+2=5, yellow 1, orange 1 (the orange/orange one),
    // red 1 (the orange/red one). total 8.
    const bd = zoneBreakdown(filterCheckIns(CHECK_INS, RANGE));
    expect(bd).toEqual({
      green: 5,
      yellow: 1,
      orange: 1,
      red: 1,
      total: 8,
    });
  });
});

describe("adherenceRate — hand-computed", () => {
  const doses: DoseDailyRow[] = [
    { day: "2026-05-10", surgeon_id: "chen", scheduled_count: 10, taken_count: 8 },
    { day: "2026-05-11", surgeon_id: "nguyen", scheduled_count: 10, taken_count: 7 },
  ];
  it("taken / scheduled = 15/20 = 0.75", () => {
    expect(adherenceRate(doses)).toBe(0.75);
  });
  it("null when nothing scheduled", () => {
    expect(adherenceRate([])).toBeNull();
  });
});

describe("completionRate — hand-computed", () => {
  it("submitted / expected = 12/20 = 0.6", () => {
    expect(
      completionRate([
        { recovery_day: 1, expected_count: 10, submitted_count: 7 },
        { recovery_day: 2, expected_count: 10, submitted_count: 5 },
      ])
    ).toBe(0.6);
  });
});

describe("medianResponseHours — hand-computed", () => {
  it("median of [1h, 2h, 6h] = 2h", () => {
    const result = medianResponseHours(
      [
        { day: "2026-05-10", response_seconds: 3600 },
        { day: "2026-05-10", response_seconds: 7200 },
        { day: "2026-05-11", response_seconds: 21600 },
        { day: "2026-05-11", response_seconds: null }, // no reply — ignored
      ],
      RANGE
    );
    expect(result).toBe(2);
  });
  it("respects the date range", () => {
    const result = medianResponseHours(
      [
        { day: "2026-01-01", response_seconds: 3600 },
        { day: "2026-05-10", response_seconds: 7200 },
      ],
      RANGE
    );
    expect(result).toBe(2); // only the May row counts
  });
});

describe("newPatientsOnboarded", () => {
  it("counts onboarding rows within the range", () => {
    expect(
      newPatientsOnboarded(
        [
          { created_day: "2026-05-05", status: "mfa_pending" },
          { created_day: "2026-05-20", status: "activated" },
          { created_day: "2026-01-01", status: "activated" }, // out of range
        ],
        RANGE
      )
    ).toBe(2);
  });
});

describe("chart series", () => {
  it("zoneOverTime buckets by day, sorted ascending", () => {
    const series = zoneOverTime(filterCheckIns(CHECK_INS, RANGE));
    expect(series.map((p) => p.day)).toEqual(["2026-05-10", "2026-05-11"]);
    expect(series[0]).toMatchObject({
      day: "2026-05-10",
      green: 3,
      yellow: 1,
      orange: 1,
      red: 0,
    });
    expect(series[1]).toMatchObject({ green: 2, red: 1 });
  });

  it("adherenceOverTime computes per-day rate", () => {
    const series = adherenceOverTime([
      { day: "2026-05-10", surgeon_id: "x", scheduled_count: 4, taken_count: 2 },
      { day: "2026-05-10", surgeon_id: "y", scheduled_count: 4, taken_count: 4 },
    ]);
    expect(series).toEqual([{ day: "2026-05-10", rate: 0.75 }]);
  });

  it("completionByRecoveryDay clamps to days 1-30", () => {
    const series = completionByRecoveryDay([
      { recovery_day: 1, expected_count: 10, submitted_count: 9 },
      { recovery_day: 45, expected_count: 5, submitted_count: 1 },
    ]);
    expect(series).toEqual([{ recovery_day: 1, rate: 0.9 }]);
  });

  it("topSymptoms ranks and limits", () => {
    const series = topSymptoms(
      [
        { day: "2026-05-10", symptom: "halos", occurrences: 2 },
        { day: "2026-05-11", symptom: "halos", occurrences: 3 },
        { day: "2026-05-10", symptom: "floaters", occurrences: 1 },
        { day: "2026-01-01", symptom: "watering", occurrences: 99 },
      ],
      RANGE,
      2
    );
    expect(series).toEqual([
      { symptom: "halos", occurrences: 5 },
      { symptom: "floaters", occurrences: 1 },
    ]);
  });

  it("procedureZoneHeatmap gives per-procedure zone fractions", () => {
    const heat = procedureZoneHeatmap(filterCheckIns(CHECK_INS, RANGE));
    const lasik = heat.find((h) => h.procedure_type === "lasik");
    // lasik: green 5, yellow 1 ⇒ total 6
    expect(lasik?.green).toBeCloseTo(5 / 6);
    expect(lasik?.yellow).toBeCloseTo(1 / 6);
  });

  it("surgeonStats computes per-surgeon adherence + flag rate", () => {
    const stats = surgeonStats(filterCheckIns(CHECK_INS, RANGE), [
      { day: "2026-05-10", surgeon_id: "chen", scheduled_count: 10, taken_count: 9 },
    ]);
    const chen = stats.find((s) => s.surgeon_id === "chen");
    // chen check-ins: green 5, yellow 1 ⇒ flagRate 1/6
    expect(chen?.flagRate).toBeCloseTo(1 / 6);
    expect(chen?.adherence).toBe(0.9);
  });
});

describe("filterDoses", () => {
  it("restricts doses to the date range", () => {
    const filtered = filterDoses(
      [
        { day: "2026-05-10", surgeon_id: "x", scheduled_count: 1, taken_count: 1 },
        { day: "2026-01-01", surgeon_id: "x", scheduled_count: 1, taken_count: 1 },
      ],
      RANGE
    );
    expect(filtered).toHaveLength(1);
  });
});

describe("aggregatesToCsv — aggregates only, no PII", () => {
  const csv = aggregatesToCsv(
    ["day", "green", "yellow", "orange", "red"],
    [
      ["2026-05-10", 3, 1, 1, 0],
      ["2026-05-11", 2, 0, 0, 1],
    ]
  );

  it("emits a header + one line per aggregate row", () => {
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("contains no patient names — only aggregate values", () => {
    // The seed patients are named "Test Patient One".."Five" and the
    // surgeons "Dr Maria Chen" / "Dr Jonathan Nguyen". None may appear.
    expect(/Test Patient/i.test(csv)).toBe(false);
    expect(/Dr (Maria|Jonathan)/i.test(csv)).toBe(false);
    // Only digits, dates, commas, quotes, and the known headers.
    expect(csv).toContain('"day"');
    expect(csv).toContain('"2026-05-10"');
  });

  it("escapes embedded quotes (RFC 4180)", () => {
    expect(aggregatesToCsv(["x"], [['a"b']])).toContain('"a""b"');
  });
});

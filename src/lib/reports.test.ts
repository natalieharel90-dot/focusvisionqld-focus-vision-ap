import { describe, expect, it } from "vitest";

import {
  type CohortReportFilter,
  type CohortPatientInput,
  adherenceRate,
  flagRatePer100RecoveryDays,
  formatDuration,
  matchesCohortReport,
  median,
  pct,
  reportZone,
  zoneDistribution,
} from "./reports";

describe("median", () => {
  it("returns the middle value for odd-length input", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middle values for even-length input", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("is null for empty input", () => {
    expect(median([])).toBeNull();
  });
});

describe("pct / adherenceRate", () => {
  it("pct is a whole percentage, 0 when whole is 0", () => {
    expect(pct(3, 4)).toBe(75);
    expect(pct(0, 0)).toBe(0);
  });
  it("adherenceRate is null when nothing was scheduled", () => {
    expect(adherenceRate(0, 0)).toBeNull();
    expect(adherenceRate(17, 20)).toBe(85);
  });
});

describe("reportZone / zoneDistribution", () => {
  it("a Red staff alert wins over the patient zone", () => {
    expect(
      reportZone({ patient_zone: "orange", staff_alert_level: "red" })
    ).toBe("red");
  });
  it("otherwise the patient zone is used", () => {
    expect(
      reportZone({ patient_zone: "green", staff_alert_level: "none" })
    ).toBe("green");
    expect(
      reportZone({ patient_zone: "yellow", staff_alert_level: "yellow" })
    ).toBe("yellow");
  });
  it("distributes a set of check-ins across the four zones", () => {
    const dist = zoneDistribution([
      { patient_zone: "green", staff_alert_level: "none" },
      { patient_zone: "green", staff_alert_level: "none" },
      { patient_zone: "yellow", staff_alert_level: "yellow" },
      { patient_zone: "orange", staff_alert_level: "orange" },
      { patient_zone: "orange", staff_alert_level: "red" },
    ]);
    expect(dist).toEqual({
      green: 2,
      yellow: 1,
      orange: 1,
      red: 1,
      total: 5,
    });
  });
});

describe("flagRatePer100RecoveryDays", () => {
  it("normalises flags per 100 patient-recovery-days", () => {
    // 3 flags over 600 recovery-days = 0.5 per 100
    expect(flagRatePer100RecoveryDays(3, 600)).toBe(0.5);
  });
  it("is 0 when there are no recovery-days", () => {
    expect(flagRatePer100RecoveryDays(5, 0)).toBe(0);
  });
});

describe("formatDuration", () => {
  it.each<[number | null, string]>([
    [null, "—"],
    [-1, "—"],
    [300, "5m"],
    [3600, "1h 0m"],
    [8100, "2h 15m"],
  ])("%s → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("matchesCohortReport — filters", () => {
  function patient(
    o: Partial<CohortPatientInput>
  ): CohortPatientInput {
    return {
      procedureType: "lasik",
      surgeonId: "surg-1",
      surgeryDate: "2026-03-10",
      zone: "green",
      ...o,
    };
  }
  function filter(o: Partial<CohortReportFilter>): CohortReportFilter {
    return {
      procedures: [],
      surgeonIds: [],
      surgeryFrom: null,
      surgeryTo: null,
      zone: null,
      ...o,
    };
  }

  it("an empty filter matches any patient with a surgery date", () => {
    expect(matchesCohortReport(patient({}), filter({}))).toBe(true);
    expect(
      matchesCohortReport(patient({ surgeryDate: null }), filter({}))
    ).toBe(false);
  });

  it("filters by procedure (multi-select)", () => {
    const f = filter({ procedures: ["prk", "smile"] });
    expect(matchesCohortReport(patient({ procedureType: "prk" }), f)).toBe(
      true
    );
    expect(matchesCohortReport(patient({ procedureType: "lasik" }), f)).toBe(
      false
    );
  });

  it("filters by surgeon (multi-select)", () => {
    const f = filter({ surgeonIds: ["surg-2"] });
    expect(matchesCohortReport(patient({ surgeonId: "surg-2" }), f)).toBe(true);
    expect(matchesCohortReport(patient({ surgeonId: "surg-1" }), f)).toBe(
      false
    );
  });

  it("filters by surgery date range", () => {
    const f = filter({ surgeryFrom: "2026-03-01", surgeryTo: "2026-03-31" });
    expect(
      matchesCohortReport(patient({ surgeryDate: "2026-03-10" }), f)
    ).toBe(true);
    expect(
      matchesCohortReport(patient({ surgeryDate: "2026-02-20" }), f)
    ).toBe(false);
    expect(
      matchesCohortReport(patient({ surgeryDate: "2026-04-05" }), f)
    ).toBe(false);
  });

  it("filters by current zone when set", () => {
    const f = filter({ zone: "orange" });
    expect(matchesCohortReport(patient({ zone: "orange" }), f)).toBe(true);
    expect(matchesCohortReport(patient({ zone: "green" }), f)).toBe(false);
    // "any" is treated as no zone filter
    expect(
      matchesCohortReport(patient({ zone: "green" }), filter({ zone: "any" }))
    ).toBe(true);
  });

  it("combines procedure + surgeon + date + zone", () => {
    const f = filter({
      procedures: ["lasik"],
      surgeonIds: ["surg-1"],
      surgeryFrom: "2026-03-01",
      surgeryTo: "2026-03-31",
      zone: "green",
    });
    expect(matchesCohortReport(patient({}), f)).toBe(true);
    expect(matchesCohortReport(patient({ zone: "yellow" }), f)).toBe(false);
  });
});

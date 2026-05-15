import { describe, expect, it } from "vitest";

import {
  type CohortFilter,
  type CohortPatient,
  EMPTY_COHORT_FILTER,
  canSendBulkPush,
  cohortSummary,
  countOpened,
  daysBetween,
  initials,
  matchCohort,
  openRate,
  recoveryDay,
  selectCohort,
  selectDuePushes,
} from "./bulk-push";

const TODAY = "2026-05-15";

function makePatient(
  o: Partial<CohortPatient> & { id: string }
): CohortPatient {
  return {
    name: "Test Patient",
    procedureType: "LASIK",
    surgeonId: "surg-1",
    surgeryDate: "2026-05-10", // recovery day 5 on TODAY
    openFlagLevels: [],
    lastCheckInZone: null,
    ...o,
  };
}

function filter(o: Partial<CohortFilter>): CohortFilter {
  return { ...EMPTY_COHORT_FILTER, ...o };
}

describe("recoveryDay / daysBetween", () => {
  it("counts whole days since surgery", () => {
    expect(recoveryDay("2026-05-10", TODAY)).toBe(5);
    expect(recoveryDay("2026-05-15", TODAY)).toBe(0);
    expect(recoveryDay("2026-04-15", TODAY)).toBe(30);
  });

  it("daysBetween is signed", () => {
    expect(daysBetween("2026-05-15", "2026-05-10")).toBe(-5);
  });
});

describe("matchCohort — no active procedure never matches", () => {
  it("rejects a patient with no surgery date", () => {
    const p = makePatient({ id: "p1", surgeryDate: null });
    expect(matchCohort(p, EMPTY_COHORT_FILTER, TODAY)).toBe(false);
  });

  it("rejects a patient with no procedure type", () => {
    const p = makePatient({ id: "p1", procedureType: null });
    expect(matchCohort(p, EMPTY_COHORT_FILTER, TODAY)).toBe(false);
  });

  it("an empty filter matches any patient with an active procedure", () => {
    const p = makePatient({ id: "p1" });
    expect(matchCohort(p, EMPTY_COHORT_FILTER, TODAY)).toBe(true);
  });
});

describe("matchCohort — procedure filter", () => {
  it("single procedure includes/excludes correctly", () => {
    const lasik = makePatient({ id: "p1", procedureType: "LASIK" });
    const prk = makePatient({ id: "p2", procedureType: "PRK" });
    const f = filter({ procedures: ["LASIK"] });
    expect(matchCohort(lasik, f, TODAY)).toBe(true);
    expect(matchCohort(prk, f, TODAY)).toBe(false);
  });

  it("multi-select procedure matches any listed", () => {
    const f = filter({ procedures: ["LASIK", "PRK"] });
    expect(
      matchCohort(makePatient({ id: "p1", procedureType: "PRK" }), f, TODAY)
    ).toBe(true);
    expect(
      matchCohort(makePatient({ id: "p2", procedureType: "SMILE" }), f, TODAY)
    ).toBe(false);
  });
});

describe("matchCohort — surgeon filter", () => {
  it("matches only listed surgeons", () => {
    const f = filter({ surgeonIds: ["surg-1", "surg-2"] });
    expect(
      matchCohort(makePatient({ id: "p1", surgeonId: "surg-2" }), f, TODAY)
    ).toBe(true);
    expect(
      matchCohort(makePatient({ id: "p2", surgeonId: "surg-9" }), f, TODAY)
    ).toBe(false);
  });
});

describe("matchCohort — recovery day range", () => {
  // patient is recovery day 5 on TODAY
  it.each<[number | null, number | null, boolean]>([
    [3, 7, true],
    [5, 5, true],
    [6, 10, false],
    [0, 4, false],
    [null, 7, true],
    [6, null, false],
    [null, null, true],
  ])("min=%s max=%s → %s", (min, max, expected) => {
    const f = filter({ recoveryDayMin: min, recoveryDayMax: max });
    expect(matchCohort(makePatient({ id: "p1" }), f, TODAY)).toBe(expected);
  });
});

describe("matchCohort — surgery date range", () => {
  it("includes only surgeries within the range", () => {
    const f = filter({
      surgeryDateFrom: "2026-05-01",
      surgeryDateTo: "2026-05-12",
    });
    expect(
      matchCohort(makePatient({ id: "p1", surgeryDate: "2026-05-10" }), f, TODAY)
    ).toBe(true);
    expect(
      matchCohort(makePatient({ id: "p2", surgeryDate: "2026-04-20" }), f, TODAY)
    ).toBe(false);
    expect(
      matchCohort(makePatient({ id: "p3", surgeryDate: "2026-05-14" }), f, TODAY)
    ).toBe(false);
  });
});

describe("matchCohort — manual flag status", () => {
  it("'none' excludes patients with an open flag", () => {
    const f = filter({ flagStatus: "none" });
    expect(matchCohort(makePatient({ id: "p1" }), f, TODAY)).toBe(true);
    expect(
      matchCohort(
        makePatient({ id: "p2", openFlagLevels: ["yellow"] }),
        f,
        TODAY
      )
    ).toBe(false);
  });

  it("a specific level requires that open flag level", () => {
    const f = filter({ flagStatus: "orange" });
    expect(
      matchCohort(
        makePatient({ id: "p1", openFlagLevels: ["orange"] }),
        f,
        TODAY
      )
    ).toBe(true);
    expect(
      matchCohort(
        makePatient({ id: "p2", openFlagLevels: ["yellow"] }),
        f,
        TODAY
      )
    ).toBe(false);
    expect(matchCohort(makePatient({ id: "p3" }), f, TODAY)).toBe(false);
  });
});

describe("matchCohort — last check-in zone", () => {
  it("matches the patient's last zone", () => {
    const f = filter({ lastCheckInZone: "yellow" });
    expect(
      matchCohort(
        makePatient({ id: "p1", lastCheckInZone: "yellow" }),
        f,
        TODAY
      )
    ).toBe(true);
    expect(
      matchCohort(
        makePatient({ id: "p2", lastCheckInZone: "green" }),
        f,
        TODAY
      )
    ).toBe(false);
    expect(
      matchCohort(makePatient({ id: "p3", lastCheckInZone: null }), f, TODAY)
    ).toBe(false);
  });
});

describe("selectCohort — counts across combined filters", () => {
  const patients: CohortPatient[] = [
    // LASIK, surg-1, day 5
    makePatient({ id: "a" }),
    // LASIK, surg-1, day 2
    makePatient({ id: "b", surgeryDate: "2026-05-13" }),
    // LASIK, surg-2, day 5
    makePatient({ id: "c", surgeonId: "surg-2" }),
    // PRK, surg-1, day 5
    makePatient({ id: "d", procedureType: "PRK" }),
    // LASIK, surg-1, day 5 — no active procedure
    makePatient({ id: "e", surgeryDate: null }),
  ];

  it("empty filter counts every patient with an active procedure", () => {
    expect(selectCohort(patients, EMPTY_COHORT_FILTER, TODAY)).toHaveLength(4);
  });

  it("procedure × surgeon × recovery-day narrows correctly", () => {
    const f = filter({
      procedures: ["LASIK"],
      surgeonIds: ["surg-1"],
      recoveryDayMin: 3,
      recoveryDayMax: 7,
    });
    const hits = selectCohort(patients, f, TODAY);
    // a matches; b is day 2 (out of range); c is surg-2; d is PRK; e inactive
    expect(hits.map((h) => h.patient.id)).toEqual(["a"]);
    expect(hits[0]!.recoveryDay).toBe(5);
  });

  it("multi-procedure widens the count", () => {
    const f = filter({ procedures: ["LASIK", "PRK"], surgeonIds: ["surg-1"] });
    const hits = selectCohort(patients, f, TODAY);
    expect(hits.map((h) => h.patient.id).sort()).toEqual(["a", "b", "d"]);
  });
});

describe("selectDuePushes — scheduled pushes do not fire early", () => {
  const NOW = "2026-05-15T09:00:00Z";
  const pushes = [
    { id: "past", scheduledAt: "2026-05-15T08:55:00Z", firedAt: null },
    { id: "now", scheduledAt: "2026-05-15T09:00:00Z", firedAt: null },
    { id: "future", scheduledAt: "2026-05-15T09:05:00Z", firedAt: null },
    {
      id: "already-fired",
      scheduledAt: "2026-05-15T08:00:00Z",
      firedAt: "2026-05-15T08:01:00Z",
    },
  ];

  it("includes only due, unfired pushes", () => {
    expect(selectDuePushes(pushes, NOW).map((p) => p.id)).toEqual([
      "past",
      "now",
    ]);
  });

  it("a future push is excluded until its time arrives", () => {
    expect(
      selectDuePushes(pushes, "2026-05-15T08:50:00Z").map((p) => p.id)
    ).toEqual([]);
    expect(
      selectDuePushes(pushes, "2026-05-15T09:10:00Z").map((p) => p.id)
    ).toEqual(["past", "now", "future"]);
  });
});

describe("canSendBulkPush — tier gate (Reception is view-only)", () => {
  it.each<[number | null | undefined, boolean]>([
    [1, true],
    [2, true],
    [3, false],
    [null, false],
    [undefined, false],
  ])("access_tier %s → canSend %s", (tier, expected) => {
    expect(canSendBulkPush(tier)).toBe(expected);
  });
});

describe("countOpened / openRate — engagement metrics", () => {
  it("counts only recipients with an opened_at", () => {
    const deliveries = [
      { openedAt: "2026-05-15T10:00:00Z" },
      { openedAt: null },
      { openedAt: "2026-05-15T11:00:00Z" },
      { openedAt: null },
    ];
    expect(countOpened(deliveries)).toBe(2);
  });

  it("a freshly delivered, unopened push has zero opens", () => {
    expect(countOpened([{ openedAt: null }, { openedAt: null }])).toBe(0);
  });

  it("openRate is a whole percentage, 0 when nothing reached", () => {
    expect(openRate(10, 8)).toBe(80);
    expect(openRate(3, 1)).toBe(33);
    expect(openRate(0, 0)).toBe(0);
  });
});

describe("cohortSummary", () => {
  it("formats procedure + day range", () => {
    expect(
      cohortSummary(
        filter({ procedures: ["LASIK"], recoveryDayMin: 3, recoveryDayMax: 7 }),
        14
      )
    ).toBe("14 LASIK patients · days 3–7");
  });

  it("uses 'all' when no procedure is selected and singularises", () => {
    expect(cohortSummary(EMPTY_COHORT_FILTER, 1)).toBe("1 all patient");
  });

  it("joins multiple procedures", () => {
    expect(
      cohortSummary(filter({ procedures: ["PRK", "LASIK"] }), 23)
    ).toBe("23 PRK + LASIK patients");
  });
});

describe("initials", () => {
  it.each<[string, string]>([
    ["Sarah Mills", "SM"],
    ["jordan reeves", "JR"],
    ["Cher", "CH"],
    ["  ", "?"],
    ["Mary-Anne de Vries", "MV"],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

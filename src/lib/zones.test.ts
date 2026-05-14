import { describe, expect, it } from "vitest";

import {
  routeCheckIn,
  type CheckInAnswers,
  type PatientRoutingContext,
  type RouteAction,
  type RulesetIndex,
  type SourceTier,
} from "./zones";

type RuleTuple = [item_key: string, item_value: string, route: RouteAction];

function makeIndex(buckets: Partial<Record<SourceTier, RuleTuple[]>>): RulesetIndex {
  const make = (rules?: RuleTuple[]) => {
    const m = new Map<string, RouteAction>();
    for (const [k, v, r] of rules ?? []) m.set(`${k}|${v}`, r);
    return m;
  };
  return {
    procedure_surgeon: make(buckets.procedure_surgeon),
    surgeon: make(buckets.surgeon),
    procedure: make(buckets.procedure),
    default: make(buckets.default),
  };
}

// Realistic default ruleset used across most tests. Values reflect the
// kind of thresholds the spec describes: low pain is fine, mid is yellow,
// high is orange; severe symptoms (flashes of light → retinal detachment
// risk) escalate to red regardless of pain.
const DEFAULT_RULES: RuleTuple[] = [
  // Pain (0–5)
  ["pain", "0", "off"],
  ["pain", "1", "off"],
  ["pain", "2", "yellow"],
  ["pain", "3", "orange"],
  ["pain", "4", "red"],
  ["pain", "5", "red"],
  // Light sensitivity (0–5)
  ["light_sensitivity", "0", "off"],
  ["light_sensitivity", "1", "off"],
  ["light_sensitivity", "2", "yellow"],
  ["light_sensitivity", "3", "yellow"],
  ["light_sensitivity", "4", "orange"],
  ["light_sensitivity", "5", "orange"],
  // Vision options
  ["vision", "worse", "yellow"],
  ["vision", "same", "off"],
  ["vision", "better", "off"],
  // Symptom chips
  ["chip:flashes_of_light", "true", "red"],
  ["chip:floaters", "true", "yellow"],
  ["chip:halos", "true", "yellow"],
  ["chip:grittiness", "true", "off"],
  ["chip:watering", "true", "off"],
  ["chip:eye_pain", "true", "orange"],
];

const defaultIndex = makeIndex({ default: DEFAULT_RULES });

const patient: PatientRoutingContext = {
  procedure_type: "lasik",
  surgeon_id: "surgeon-1",
};

const baseAnswers: CheckInAnswers = {
  pain: 0,
  light_sensitivity: 0,
  vision: "better",
  unusual_symptoms: [],
};

describe("routeCheckIn — pain level routing alone", () => {
  it.each<[number, "green" | "yellow" | "orange", "none" | "yellow" | "orange" | "red"]>([
    [0, "green", "none"],
    [1, "green", "none"],
    [2, "yellow", "yellow"],
    [3, "orange", "orange"],
    [4, "orange", "red"], // red route → patient sees orange, staff sees red
    [5, "orange", "red"],
  ])("pain=%i → patient_zone=%s, staff_alert_level=%s", (pain, zone, alert) => {
    const r = routeCheckIn({ ...baseAnswers, pain }, patient, defaultIndex);
    expect(r.patient_zone).toBe(zone);
    expect(r.staff_alert_level).toBe(alert);
  });
});

describe("routeCheckIn — light sensitivity level routing alone", () => {
  it.each<[number, "green" | "yellow" | "orange", "none" | "yellow" | "orange" | "red"]>([
    [0, "green", "none"],
    [1, "green", "none"],
    [2, "yellow", "yellow"],
    [3, "yellow", "yellow"],
    [4, "orange", "orange"],
    [5, "orange", "orange"],
  ])("light=%i → patient_zone=%s, staff_alert_level=%s", (light, zone, alert) => {
    const r = routeCheckIn(
      { ...baseAnswers, light_sensitivity: light },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe(zone);
    expect(r.staff_alert_level).toBe(alert);
  });
});

describe("routeCheckIn — vision option routing alone", () => {
  it.each<["worse" | "same" | "better", "green" | "yellow" | "orange", "none" | "yellow" | "orange" | "red"]>([
    ["worse", "yellow", "yellow"],
    ["same", "green", "none"],
    ["better", "green", "none"],
  ])("vision=%s → patient_zone=%s, staff_alert_level=%s", (vision, zone, alert) => {
    const r = routeCheckIn({ ...baseAnswers, vision }, patient, defaultIndex);
    expect(r.patient_zone).toBe(zone);
    expect(r.staff_alert_level).toBe(alert);
  });
});

describe("routeCheckIn — symptom chip routing", () => {
  it("flashes_of_light (red default) → patient orange + staff red", () => {
    const r = routeCheckIn(
      { ...baseAnswers, unusual_symptoms: ["flashes_of_light"] },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("orange");
    expect(r.staff_alert_level).toBe("red");
    expect(r.firing_rules).toHaveLength(1);
    expect(r.firing_rules[0]).toMatchObject({
      item_key: "chip:flashes_of_light",
      route: "red",
    });
  });

  it("eye_pain (orange default) → patient orange + staff orange", () => {
    const r = routeCheckIn(
      { ...baseAnswers, unusual_symptoms: ["eye_pain"] },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("orange");
    expect(r.staff_alert_level).toBe("orange");
  });

  it("floaters (yellow) → yellow / yellow", () => {
    const r = routeCheckIn(
      { ...baseAnswers, unusual_symptoms: ["floaters"] },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("yellow");
    expect(r.staff_alert_level).toBe("yellow");
  });

  it("grittiness (off) → green / none, no firing rule", () => {
    const r = routeCheckIn(
      { ...baseAnswers, unusual_symptoms: ["grittiness"] },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("green");
    expect(r.staff_alert_level).toBe("none");
    expect(r.firing_rules).toEqual([]);
  });

  it("unknown chip → no rule found, no contribution", () => {
    const r = routeCheckIn(
      { ...baseAnswers, unusual_symptoms: ["never_heard_of_this"] },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("green");
    expect(r.firing_rules).toEqual([]);
  });

  it("multiple chips: most severe wins, all non-off chips fire", () => {
    const r = routeCheckIn(
      {
        ...baseAnswers,
        unusual_symptoms: ["halos", "eye_pain", "flashes_of_light"],
      },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("orange");
    expect(r.staff_alert_level).toBe("red");
    expect(r.firing_rules).toHaveLength(3);
  });
});

describe("routeCheckIn — green case (all answers off)", () => {
  it("everything off → green / none, no firing rules", () => {
    const r = routeCheckIn(baseAnswers, patient, defaultIndex);
    expect(r.patient_zone).toBe("green");
    expect(r.staff_alert_level).toBe("none");
    expect(r.firing_rules).toEqual([]);
  });
});

describe("routeCheckIn — red collapses to orange for the patient", () => {
  it("pain 4 (red) → patient sees orange, staff sees red", () => {
    const r = routeCheckIn({ ...baseAnswers, pain: 4 }, patient, defaultIndex);
    expect(r.patient_zone).toBe("orange");
    expect(r.staff_alert_level).toBe("red");
  });

  it("flashes of light (red) → patient sees orange, staff sees red", () => {
    const r = routeCheckIn(
      { ...baseAnswers, unusual_symptoms: ["flashes_of_light"] },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("orange");
    expect(r.staff_alert_level).toBe("red");
  });

  it("two red routes together: still patient orange, staff red", () => {
    const r = routeCheckIn(
      {
        ...baseAnswers,
        pain: 5,
        unusual_symptoms: ["flashes_of_light"],
      },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("orange");
    expect(r.staff_alert_level).toBe("red");
  });
});

describe("routeCheckIn — most severe wins (combination)", () => {
  it("pain 3 (orange) + flashes (red) → patient orange + staff red", () => {
    const r = routeCheckIn(
      {
        ...baseAnswers,
        pain: 3,
        unusual_symptoms: ["flashes_of_light"],
      },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("orange");
    expect(r.staff_alert_level).toBe("red");
  });

  it("pain 2 (yellow) + vision worse (yellow) → yellow / yellow", () => {
    const r = routeCheckIn(
      { ...baseAnswers, pain: 2, vision: "worse" },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("yellow");
    expect(r.staff_alert_level).toBe("yellow");
  });

  it("pain 2 (yellow) + light 4 (orange) → orange / orange", () => {
    const r = routeCheckIn(
      { ...baseAnswers, pain: 2, light_sensitivity: 4 },
      patient,
      defaultIndex
    );
    expect(r.patient_zone).toBe("orange");
    expect(r.staff_alert_level).toBe("orange");
  });
});

describe("routeCheckIn — ruleset fallback (per-rule, 4-tier most-specific-wins)", () => {
  it("surgeon overrides default: pain 3 → yellow instead of orange", () => {
    const index = makeIndex({
      default: [["pain", "3", "orange"]],
      surgeon: [["pain", "3", "yellow"]],
    });
    const r = routeCheckIn({ ...baseAnswers, pain: 3 }, patient, index);
    expect(r.patient_zone).toBe("yellow");
    expect(r.staff_alert_level).toBe("yellow");
    expect(r.firing_rules[0]?.source_tier).toBe("surgeon");
  });

  it("procedure × surgeon beats surgeon beats procedure beats default", () => {
    const index = makeIndex({
      procedure_surgeon: [["pain", "3", "off"]],
      surgeon: [["pain", "3", "yellow"]],
      procedure: [["pain", "3", "orange"]],
      default: [["pain", "3", "red"]],
    });
    const r = routeCheckIn({ ...baseAnswers, pain: 3 }, patient, index);
    // procedure_surgeon wins, route=off → no firing
    expect(r.patient_zone).toBe("green");
    expect(r.staff_alert_level).toBe("none");
    expect(r.firing_rules).toEqual([]);
  });

  it("surgeon beats procedure beats default (3 tiers populated)", () => {
    const index = makeIndex({
      surgeon: [["pain", "3", "yellow"]],
      procedure: [["pain", "3", "orange"]],
      default: [["pain", "3", "red"]],
    });
    const r = routeCheckIn({ ...baseAnswers, pain: 3 }, patient, index);
    expect(r.firing_rules[0]?.source_tier).toBe("surgeon");
    expect(r.patient_zone).toBe("yellow");
  });

  it("falls back per-rule: procedure overrides pain 5, default still handles pain 3", () => {
    const index = makeIndex({
      procedure: [["pain", "5", "yellow"]], // procedure-only override of just pain=5
      default: [
        ["pain", "3", "orange"],
        ["pain", "5", "red"],
      ],
    });

    // pain=3 finds no procedure rule, falls through to default (orange)
    const r3 = routeCheckIn({ ...baseAnswers, pain: 3 }, patient, index);
    expect(r3.patient_zone).toBe("orange");
    expect(r3.firing_rules[0]?.source_tier).toBe("default");

    // pain=5 finds procedure rule (yellow), short-circuits before default
    const r5 = routeCheckIn({ ...baseAnswers, pain: 5 }, patient, index);
    expect(r5.patient_zone).toBe("yellow");
    expect(r5.firing_rules[0]?.source_tier).toBe("procedure");
  });

  it("missing rule altogether: no contribution (treated as off)", () => {
    const index = makeIndex({ default: [] });
    const r = routeCheckIn({ ...baseAnswers, pain: 3 }, patient, index);
    expect(r.patient_zone).toBe("green");
    expect(r.firing_rules).toEqual([]);
  });
});

describe("routeCheckIn — firing rules carry source tier for audit", () => {
  it("each firing rule reports the tier it came from", () => {
    const index = makeIndex({
      procedure_surgeon: [["chip:flashes_of_light", "true", "red"]],
      default: [
        ["pain", "3", "orange"],
        ["vision", "worse", "yellow"],
      ],
    });
    const r = routeCheckIn(
      {
        pain: 3,
        light_sensitivity: 0,
        vision: "worse",
        unusual_symptoms: ["flashes_of_light"],
      },
      patient,
      index
    );

    const byKey = new Map(r.firing_rules.map((h) => [h.item_key, h.source_tier]));
    expect(byKey.get("chip:flashes_of_light")).toBe("procedure_surgeon");
    expect(byKey.get("pain")).toBe("default");
    expect(byKey.get("vision")).toBe("default");
  });
});

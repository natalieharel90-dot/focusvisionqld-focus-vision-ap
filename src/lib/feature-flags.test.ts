import { describe, expect, it } from "vitest";

import {
  FEATURES,
  NUDGE_TIMES,
  resolveFeature,
  resolveFeatureByKey,
} from "./feature-flags";

describe("resolveFeature — override > default > schema", () => {
  it("a patient flag wins over the clinic default and schema default", () => {
    expect(resolveFeature({ enabled: true }, { enabled: false }, false)).toBe(
      true
    );
    expect(resolveFeature({ enabled: false }, { enabled: true }, true)).toBe(
      false
    );
  });

  it("falls back to the clinic default when there is no patient flag", () => {
    expect(resolveFeature(null, { enabled: true }, false)).toBe(true);
    expect(resolveFeature(undefined, { enabled: false }, true)).toBe(false);
  });

  it("falls back to the schema default when nothing is set", () => {
    expect(resolveFeature(null, null, true)).toBe(true);
    expect(resolveFeature(null, null, false)).toBe(false);
  });
});

describe("resolveFeature — changing a clinic default does not retroact", () => {
  it("a patient with a flag is unaffected when the clinic default flips", () => {
    const patientFlag = { enabled: true };
    // Clinic default was ON when the patient activated…
    expect(resolveFeature(patientFlag, { enabled: true }, true)).toBe(true);
    // …staff later flip the clinic default OFF — the patient is unchanged.
    expect(resolveFeature(patientFlag, { enabled: false }, true)).toBe(true);
  });
});

describe("resolveFeatureByKey", () => {
  it("resolves from the patient + clinic maps", () => {
    const patientFlags = new Map([["feedback_tile", { enabled: false }]]);
    const clinicDefaults = new Map([["feedback_tile", { enabled: true }]]);
    expect(
      resolveFeatureByKey("feedback_tile", patientFlags, clinicDefaults)
    ).toBe(false);
  });

  it("uses the schema default for an unknown/unset feature", () => {
    expect(
      resolveFeatureByKey("surgeon_spotlight", new Map(), new Map())
    ).toBe(false); // surgeon_spotlight schema default is OFF
    expect(resolveFeatureByKey("checkin_nudge", new Map(), new Map())).toBe(
      true
    ); // checkin_nudge schema default is ON
  });
});

describe("bonus theme pack eligibility", () => {
  it("is OFF by default — no patient flag, no clinic default", () => {
    expect(
      resolveFeatureByKey("bonus_theme_pack", new Map(), new Map())
    ).toBe(false);
  });

  it("a per-patient override enables/disables it for that patient", () => {
    const clinicOff = new Map([["bonus_theme_pack", { enabled: false }]]);
    // Staff enable it for one patient.
    expect(
      resolveFeatureByKey(
        "bonus_theme_pack",
        new Map([["bonus_theme_pack", { enabled: true }]]),
        clinicOff
      )
    ).toBe(true);
    // Staff disable it for one patient even though the clinic default is ON.
    expect(
      resolveFeatureByKey(
        "bonus_theme_pack",
        new Map([["bonus_theme_pack", { enabled: false }]]),
        new Map([["bonus_theme_pack", { enabled: true }]])
      )
    ).toBe(false);
  });

  it("flipping the clinic default never retroacts onto an existing patient", () => {
    // An activated patient has a snapshotted flag row; later default flips.
    const patientFlag = { enabled: false };
    expect(
      resolveFeature(patientFlag, { enabled: false }, false)
    ).toBe(false);
    expect(
      resolveFeature(patientFlag, { enabled: true }, false)
    ).toBe(false);
  });
});

describe("FEATURES metadata", () => {
  it("defines the six optional features", () => {
    expect(FEATURES).toHaveLength(6);
  });

  it("surgeon spotlight is OFF by default, check-in nudge is ON", () => {
    const byKey = new Map(FEATURES.map((f) => [f.key, f]));
    expect(byKey.get("surgeon_spotlight")?.schemaDefault).toBe(false);
    expect(byKey.get("checkin_nudge")?.schemaDefault).toBe(true);
  });

  it("the bonus theme pack is OFF by default and carries a settings note", () => {
    const byKey = new Map(FEATURES.map((f) => [f.key, f]));
    const pack = byKey.get("bonus_theme_pack");
    expect(pack?.schemaDefault).toBe(false);
    expect(pack?.hasConfig).toBe(false);
    expect(pack?.note).toBeTruthy();
  });

  it("only the check-in nudge carries config", () => {
    const withConfig = FEATURES.filter((f) => f.hasConfig).map((f) => f.key);
    expect(withConfig).toEqual(["checkin_nudge"]);
  });
});

describe("NUDGE_TIMES", () => {
  it("offers the 12 / 2 / 4 / 6 PM options", () => {
    expect(NUDGE_TIMES.map((t) => t.value)).toEqual([
      "12:00",
      "14:00",
      "16:00",
      "18:00",
    ]);
  });
});

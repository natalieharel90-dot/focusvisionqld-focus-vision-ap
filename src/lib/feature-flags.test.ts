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
    expect(resolveFeatureByKey("eye_photo_prompt", new Map(), new Map())).toBe(
      true
    ); // eye_photo_prompt schema default is ON
  });
});

describe("FEATURES metadata", () => {
  it("defines the six optional features", () => {
    expect(FEATURES).toHaveLength(6);
  });

  it("surgeon spotlight is OFF by default, eye photo prompt is ON", () => {
    const byKey = new Map(FEATURES.map((f) => [f.key, f]));
    expect(byKey.get("surgeon_spotlight")?.schemaDefault).toBe(false);
    expect(byKey.get("eye_photo_prompt")?.schemaDefault).toBe(true);
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

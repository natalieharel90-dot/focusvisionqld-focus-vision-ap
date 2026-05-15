import { describe, expect, it } from "vitest";

import {
  PLACEHOLDER_WARNING,
  bucketZoneRows,
  classifyZoneRow,
  computeZoneContentDiff,
  mergeZoneFields,
  type ZoneContentFields,
  type ZoneContentScopedRow,
} from "./zone-content";

const SURGEON = "surgeon-uuid-1";
const OTHER_SURGEON = "surgeon-uuid-2";

function fields(partial: Partial<ZoneContentFields>): ZoneContentFields {
  return {
    headline: null,
    message: null,
    expected_symptoms: null,
    today_tip: null,
    instructions: null,
    warning: null,
    ...partial,
  };
}

function scoped(
  procedure_type: string | null,
  surgeon_id: string | null,
  partial: Partial<ZoneContentFields>
): ZoneContentScopedRow {
  return { procedure_type, surgeon_id, ...fields(partial) };
}

describe("classifyZoneRow", () => {
  const query = { procedure_type: "lasik", surgeon_id: SURGEON };
  it("identifies the most-specific tier", () => {
    expect(
      classifyZoneRow({ procedure_type: "lasik", surgeon_id: SURGEON }, query)
    ).toBe("procedure_surgeon");
  });
  it("identifies surgeon-only", () => {
    expect(
      classifyZoneRow({ procedure_type: null, surgeon_id: SURGEON }, query)
    ).toBe("surgeon");
  });
  it("identifies procedure-only", () => {
    expect(
      classifyZoneRow({ procedure_type: "lasik", surgeon_id: null }, query)
    ).toBe("procedure");
  });
  it("identifies default", () => {
    expect(
      classifyZoneRow({ procedure_type: null, surgeon_id: null }, query)
    ).toBe("default");
  });
  it("ignores rows for a different surgeon", () => {
    expect(
      classifyZoneRow(
        { procedure_type: null, surgeon_id: OTHER_SURGEON },
        query
      )
    ).toBeNull();
  });
});

describe("mergeZoneFields — per-field fallback", () => {
  it("a surgeon-specific row overrides only the headline, inheriting the rest", () => {
    // procedure default supplies message + symptoms + tip; surgeon row
    // overrides just the headline.
    const buckets = bucketZoneRows(
      [
        scoped(null, null, {
          headline: "Default headline",
          message: "Default message",
          expected_symptoms: ["d1"],
          today_tip: "Default tip",
        }),
        scoped("lasik", null, {
          headline: "LASIK headline",
          message: "LASIK message",
          expected_symptoms: ["l1", "l2"],
          today_tip: "LASIK tip",
        }),
        // Surgeon-specific Yellow: only headline set, rest NULL.
        scoped(null, SURGEON, { headline: "Dr Chen headline" }),
      ],
      { procedure_type: "lasik", surgeon_id: SURGEON }
    );
    const merged = mergeZoneFields(buckets);
    expect(merged).not.toBeNull();
    // headline comes from the surgeon tier
    expect(merged?.headline).toBe("Dr Chen headline");
    // message / symptoms / tip fall through to the procedure default
    expect(merged?.message).toBe("LASIK message");
    expect(merged?.expected_symptoms).toEqual(["l1", "l2"]);
    expect(merged?.today_tip).toBe("LASIK tip");
  });

  it("falls all the way through to Default when nothing else is set", () => {
    const buckets = bucketZoneRows(
      [
        scoped(null, null, {
          headline: "Default headline",
          message: "Default message",
        }),
      ],
      { procedure_type: "lasik", surgeon_id: SURGEON }
    );
    const merged = mergeZoneFields(buckets);
    expect(merged?.headline).toBe("Default headline");
    expect(merged?.message).toBe("Default message");
  });

  it("returns null when no tier has a row", () => {
    const buckets = bucketZoneRows([], {
      procedure_type: "lasik",
      surgeon_id: SURGEON,
    });
    expect(mergeZoneFields(buckets)).toBeNull();
  });
});

describe("patient-side lookup — content per specificity tier", () => {
  // The full hierarchy, all four tiers populated with a distinct headline.
  const allRows: ZoneContentScopedRow[] = [
    scoped(null, null, { headline: "DEFAULT" }),
    scoped("lasik", null, { headline: "PROCEDURE" }),
    scoped(null, SURGEON, { headline: "SURGEON" }),
    scoped("lasik", SURGEON, { headline: "PROC_SURGEON" }),
  ];

  it("tier 1: (procedure × surgeon) wins when both are specified", () => {
    const merged = mergeZoneFields(
      bucketZoneRows(allRows, { procedure_type: "lasik", surgeon_id: SURGEON })
    );
    expect(merged?.headline).toBe("PROC_SURGEON");
  });

  it("tier 2: surgeon-only wins for that surgeon on a different procedure", () => {
    const merged = mergeZoneFields(
      bucketZoneRows(allRows, { procedure_type: "prk", surgeon_id: SURGEON })
    );
    expect(merged?.headline).toBe("SURGEON");
  });

  it("tier 3: procedure-only wins for that procedure with a different surgeon", () => {
    const merged = mergeZoneFields(
      bucketZoneRows(allRows, {
        procedure_type: "lasik",
        surgeon_id: OTHER_SURGEON,
      })
    );
    expect(merged?.headline).toBe("PROCEDURE");
  });

  it("tier 4: default wins for an unmatched procedure + surgeon", () => {
    const merged = mergeZoneFields(
      bucketZoneRows(allRows, {
        procedure_type: "smile",
        surgeon_id: OTHER_SURGEON,
      })
    );
    expect(merged?.headline).toBe("DEFAULT");
  });
});

describe("computeZoneContentDiff — save only what differs from parent", () => {
  const parent = fields({
    headline: "Parent headline",
    message: "Parent message",
    expected_symptoms: ["a", "b"],
    today_tip: "Parent tip",
  });

  it("a set identical to the parent is fully inherited (no row written)", () => {
    const editor = fields({
      headline: "Parent headline",
      message: "Parent message",
      expected_symptoms: ["a", "b"],
      today_tip: "Parent tip",
    });
    const { stored, allInherited } = computeZoneContentDiff(editor, parent);
    expect(allInherited).toBe(true);
    expect(stored.headline).toBeNull();
    expect(stored.message).toBeNull();
    expect(stored.expected_symptoms).toBeNull();
    expect(stored.today_tip).toBeNull();
  });

  it("only the changed field is persisted; the rest stay NULL", () => {
    const editor = fields({
      headline: "Changed headline",
      message: "Parent message",
      expected_symptoms: ["a", "b"],
      today_tip: "Parent tip",
    });
    const { stored, allInherited } = computeZoneContentDiff(editor, parent);
    expect(allInherited).toBe(false);
    expect(stored.headline).toBe("Changed headline");
    expect(stored.message).toBeNull();
    expect(stored.expected_symptoms).toBeNull();
    expect(stored.today_tip).toBeNull();
  });

  it("treats whitespace-only differences as equal (trimmed compare)", () => {
    const editor = fields({
      headline: "  Parent headline  ",
      message: "Parent message",
      expected_symptoms: ["a", "b"],
      today_tip: "Parent tip",
    });
    const { allInherited } = computeZoneContentDiff(editor, parent);
    expect(allInherited).toBe(true);
  });

  it("detects a changed symptom list", () => {
    const editor = fields({
      headline: "Parent headline",
      message: "Parent message",
      expected_symptoms: ["a", "b", "c"],
      today_tip: "Parent tip",
    });
    const { stored } = computeZoneContentDiff(editor, parent);
    expect(stored.expected_symptoms).toEqual(["a", "b", "c"]);
  });

  it("the Default tier (no parent) stores every field as-is", () => {
    const editor = fields({ headline: "H", message: "M" });
    const { stored, allInherited } = computeZoneContentDiff(editor, null);
    expect(allInherited).toBe(false);
    expect(stored).toEqual(editor);
  });
});

describe("placeholder warning", () => {
  it("exists and mentions placeholder content + clinical sign-off", () => {
    expect(PLACEHOLDER_WARNING.length).toBeGreaterThan(0);
    expect(PLACEHOLDER_WARNING.toLowerCase()).toContain("placeholder");
    expect(PLACEHOLDER_WARNING.toLowerCase()).toContain("signed off");
  });
});

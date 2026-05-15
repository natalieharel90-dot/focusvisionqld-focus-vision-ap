import { describe, expect, it } from "vitest";

import {
  CHECKLIST_ITEMS,
  cardMatchesFilters,
  deriveStatus,
  freshChecklist,
  isVisibleInKanban,
  markItemDone,
  medianTimeToActivateMs,
  parseChecklist,
  type Checklist,
  type SetupCardLike,
} from "./setup-tasks";

const NOW_ISO = "2026-05-15T09:00:00Z";
const STAFF = "staff-uuid-1";

describe("freshChecklist + deriveStatus — starting column", () => {
  it("a patient created via Set up new patient starts in MFA pending", () => {
    // The Set up new patient flow applies the template, leaving MFA and
    // the rest pending.
    const checklist = freshChecklist(NOW_ISO);
    expect(checklist.template_applied.done).toBe(true);
    expect(checklist.mfa_verified.done).toBe(false);
    expect(deriveStatus(checklist)).toBe("mfa_pending");
  });
});

describe("deriveStatus", () => {
  function checklist(done: Partial<Record<string, boolean>>): Checklist {
    const c = {} as Checklist;
    for (const item of CHECKLIST_ITEMS) {
      c[item.key] = {
        done: done[item.key] ?? false,
        done_at: done[item.key] ? NOW_ISO : null,
        done_by: done[item.key] ? STAFF : null,
      };
    }
    return c;
  }

  it("MFA undone ⇒ mfa_pending (regardless of other progress)", () => {
    expect(
      deriveStatus(
        checklist({ template_applied: true, welcome_sent: true })
      )
    ).toBe("mfa_pending");
  });

  it("MFA done, no setup items ⇒ awaiting_setup", () => {
    expect(deriveStatus(checklist({ mfa_verified: true }))).toBe(
      "awaiting_setup"
    );
  });

  it("MFA done, some setup items ⇒ partial", () => {
    expect(
      deriveStatus(
        checklist({ mfa_verified: true, template_applied: true })
      )
    ).toBe("partial");
  });

  it("every item done ⇒ activated", () => {
    expect(
      deriveStatus(
        checklist({
          mfa_verified: true,
          template_applied: true,
          welcome_sent: true,
          first_appointment_booked: true,
          preop_content_assigned: true,
        })
      )
    ).toBe("activated");
  });
});

describe("markItemDone — completing every item activates the patient", () => {
  it("walks mfa_pending → ... → activated as items complete", () => {
    let c = freshChecklist(NOW_ISO);
    expect(deriveStatus(c)).toBe("mfa_pending");

    c = markItemDone(c, "mfa_verified", STAFF, NOW_ISO);
    expect(deriveStatus(c)).toBe("partial"); // template already done

    c = markItemDone(c, "welcome_sent", STAFF, NOW_ISO);
    c = markItemDone(c, "first_appointment_booked", STAFF, NOW_ISO);
    expect(deriveStatus(c)).toBe("partial");

    c = markItemDone(c, "preop_content_assigned", STAFF, NOW_ISO);
    expect(deriveStatus(c)).toBe("activated");
  });

  it("records done_at + done_by on the completed item", () => {
    const c = markItemDone(
      freshChecklist(NOW_ISO),
      "welcome_sent",
      STAFF,
      NOW_ISO
    );
    expect(c.welcome_sent).toEqual({
      done: true,
      done_at: NOW_ISO,
      done_by: STAFF,
    });
  });

  it("does not mutate the input checklist", () => {
    const original = freshChecklist(NOW_ISO);
    markItemDone(original, "welcome_sent", STAFF, NOW_ISO);
    expect(original.welcome_sent.done).toBe(false);
  });
});

describe("isVisibleInKanban — 7-day disappearance rule", () => {
  const now = new Date("2026-05-15T12:00:00Z");

  it("non-activated tasks are always visible", () => {
    for (const status of ["mfa_pending", "awaiting_setup", "partial"] as const) {
      expect(
        isVisibleInKanban({ status, activated_at: null }, now)
      ).toBe(true);
    }
  });

  it("activated < 7 days ago stays on the board", () => {
    expect(
      isVisibleInKanban(
        { status: "activated", activated_at: "2026-05-13T12:00:00Z" },
        now
      )
    ).toBe(true);
  });

  it("activated > 7 days ago drops off the board", () => {
    expect(
      isVisibleInKanban(
        { status: "activated", activated_at: "2026-05-05T12:00:00Z" },
        now
      )
    ).toBe(false);
  });

  it("exactly 7 days is still visible (inclusive boundary)", () => {
    expect(
      isVisibleInKanban(
        { status: "activated", activated_at: "2026-05-08T12:00:00Z" },
        now
      )
    ).toBe(true);
  });
});

describe("medianTimeToActivateMs", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  const DAY = 24 * 60 * 60 * 1000;

  it("returns null when nothing has been activated", () => {
    expect(
      medianTimeToActivateMs(
        [{ created_at: "2026-05-10T00:00:00Z", activated_at: null }],
        now
      )
    ).toBeNull();
  });

  it("median of two activations = their average duration", () => {
    // Patient A: created 2026-05-11, activated 2026-05-13 ⇒ 2 days
    // Patient B: created 2026-05-09, activated 2026-05-13 ⇒ 4 days
    const result = medianTimeToActivateMs(
      [
        {
          created_at: "2026-05-11T00:00:00Z",
          activated_at: "2026-05-13T00:00:00Z",
        },
        {
          created_at: "2026-05-09T00:00:00Z",
          activated_at: "2026-05-13T00:00:00Z",
        },
      ],
      now
    );
    expect(result).toBe(3 * DAY); // (2 + 4) / 2
  });

  it("odd count picks the middle duration", () => {
    const result = medianTimeToActivateMs(
      [
        { created_at: "2026-05-14T00:00:00Z", activated_at: "2026-05-15T00:00:00Z" }, // 1d
        { created_at: "2026-05-11T00:00:00Z", activated_at: "2026-05-13T00:00:00Z" }, // 2d
        { created_at: "2026-05-08T00:00:00Z", activated_at: "2026-05-13T00:00:00Z" }, // 5d
      ],
      now
    );
    expect(result).toBe(2 * DAY);
  });

  it("ignores activations older than 30 days", () => {
    const result = medianTimeToActivateMs(
      [
        // way back in March — excluded
        { created_at: "2026-03-01T00:00:00Z", activated_at: "2026-03-03T00:00:00Z" },
        // recent — included, 2 days
        { created_at: "2026-05-11T00:00:00Z", activated_at: "2026-05-13T00:00:00Z" },
      ],
      now
    );
    expect(result).toBe(2 * DAY);
  });
});

describe("cardMatchesFilters — queue filter bar", () => {
  const cards: SetupCardLike[] = [
    {
      patient_name: "Test Patient One",
      surgeon_id: "chen",
      surgery_date: "2026-05-10",
    },
    {
      patient_name: "Test Patient Two",
      surgeon_id: "nguyen",
      surgery_date: "2026-05-20",
    },
    {
      patient_name: "Test Patient Three",
      surgeon_id: "chen",
      surgery_date: "2026-06-01",
    },
  ];

  const noFilter = {
    surgeonId: null,
    surgeryFrom: null,
    surgeryTo: null,
    nameSearch: null,
  };

  it("filter by surgeon returns only that surgeon's patients", () => {
    const chenCards = cards.filter((c) =>
      cardMatchesFilters(c, { ...noFilter, surgeonId: "chen" })
    );
    expect(chenCards.map((c) => c.patient_name)).toEqual([
      "Test Patient One",
      "Test Patient Three",
    ]);
  });

  it("surgery date range filters inclusively", () => {
    const inRange = cards.filter((c) =>
      cardMatchesFilters(c, {
        ...noFilter,
        surgeryFrom: "2026-05-15",
        surgeryTo: "2026-05-31",
      })
    );
    expect(inRange.map((c) => c.patient_name)).toEqual(["Test Patient Two"]);
  });

  it("name search is case-insensitive substring", () => {
    const found = cards.filter((c) =>
      cardMatchesFilters(c, { ...noFilter, nameSearch: "three" })
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.patient_name).toBe("Test Patient Three");
  });

  it("filters combine with AND", () => {
    const found = cards.filter((c) =>
      cardMatchesFilters(c, {
        ...noFilter,
        surgeonId: "chen",
        nameSearch: "two",
      })
    );
    expect(found).toHaveLength(0); // patient Two is Nguyen's
  });
});

describe("parseChecklist", () => {
  it("parses a well-formed JSONB checklist", () => {
    const c = parseChecklist({
      mfa_verified: { done: true, done_at: NOW_ISO, done_by: STAFF },
    });
    expect(c.mfa_verified.done).toBe(true);
    // missing keys default to not-done
    expect(c.welcome_sent.done).toBe(false);
  });

  it("returns an all-pending checklist for garbage input", () => {
    const c = parseChecklist(null);
    expect(deriveStatus(c)).toBe("mfa_pending");
  });
});

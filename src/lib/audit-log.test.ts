import { describe, expect, it } from "vitest";

import {
  auditEventMatchesFilters,
  auditEventsToCsv,
  canAccessAuditLog,
  defaultDateRange,
  parseAuditFilters,
  summarizeAuditEvent,
  type AuditCsvRow,
  type AuditEventLike,
  type AuditFilters,
} from "./audit-log";

describe("canAccessAuditLog — tier-1-only gate", () => {
  it("tier 1 (Owner/Admin/Clinical Lead) can access", () => {
    expect(canAccessAuditLog(1)).toBe(true);
  });
  it("tier 2 (clinical staff) gets denied", () => {
    expect(canAccessAuditLog(2)).toBe(false);
  });
  it("tier 3 (limited) gets denied", () => {
    expect(canAccessAuditLog(3)).toBe(false);
  });
  it("null / undefined access tier is denied", () => {
    expect(canAccessAuditLog(null)).toBe(false);
    expect(canAccessAuditLog(undefined)).toBe(false);
  });
});

describe("parseAuditFilters", () => {
  const NOW = new Date("2026-05-15T12:00:00Z");

  it("defaults to the last 7 days when no range given", () => {
    const f = parseAuditFilters({}, NOW);
    expect(f.from).toBe("2026-05-08");
    expect(f.to).toBe("2026-05-15");
  });

  it("reads explicit filter values from query params", () => {
    const f = parseAuditFilters(
      {
        from: "2026-01-01",
        to: "2026-02-01",
        actor: "staff-1",
        patient: "patient-9",
        events: ["staff.signed_in", "patient.created"],
        page: "3",
      },
      NOW
    );
    expect(f).toEqual({
      from: "2026-01-01",
      to: "2026-02-01",
      actorStaffId: "staff-1",
      patientId: "patient-9",
      eventTypes: ["staff.signed_in", "patient.created"],
      page: 3,
    });
  });

  it("parses a comma-joined events string", () => {
    const f = parseAuditFilters({ events: "a,b,c" }, NOW);
    expect(f.eventTypes).toEqual(["a", "b", "c"]);
  });

  it("clamps an invalid page to 1", () => {
    expect(parseAuditFilters({ page: "0" }, NOW).page).toBe(1);
    expect(parseAuditFilters({ page: "-2" }, NOW).page).toBe(1);
    expect(parseAuditFilters({ page: "abc" }, NOW).page).toBe(1);
  });
});

describe("defaultDateRange", () => {
  it("spans 7 days back through today", () => {
    const { from, to } = defaultDateRange(new Date("2026-05-15T00:00:00Z"));
    expect(from).toBe("2026-05-08");
    expect(to).toBe("2026-05-15");
  });
});

describe("auditEventMatchesFilters — filter combinations", () => {
  const base: AuditFilters = {
    from: "2026-05-01",
    to: "2026-05-31",
    actorStaffId: null,
    patientId: null,
    eventTypes: [],
    page: 1,
  };
  const event = (over: Partial<AuditEventLike>): AuditEventLike => ({
    created_at: "2026-05-15T10:00:00Z",
    actor_staff_id: "staff-1",
    event_type: "patient.created",
    patient_id: "patient-1",
    old_value: null,
    new_value: { x: 1 },
    ...over,
  });

  it("date range only: in-range passes, out-of-range fails", () => {
    expect(auditEventMatchesFilters(event({}), base)).toBe(true);
    expect(
      auditEventMatchesFilters(
        event({ created_at: "2026-04-30T10:00:00Z" }),
        base
      )
    ).toBe(false);
    expect(
      auditEventMatchesFilters(
        event({ created_at: "2026-06-01T10:00:00Z" }),
        base
      )
    ).toBe(false);
  });

  it("includes the full final day (end-of-day boundary)", () => {
    expect(
      auditEventMatchesFilters(
        event({ created_at: "2026-05-31T23:30:00Z" }),
        base
      )
    ).toBe(true);
  });

  it("actor filter restricts to one staff member", () => {
    const f = { ...base, actorStaffId: "staff-1" };
    expect(auditEventMatchesFilters(event({}), f)).toBe(true);
    expect(
      auditEventMatchesFilters(event({ actor_staff_id: "staff-2" }), f)
    ).toBe(false);
  });

  it("patient filter restricts to one patient", () => {
    const f = { ...base, patientId: "patient-1" };
    expect(auditEventMatchesFilters(event({}), f)).toBe(true);
    expect(
      auditEventMatchesFilters(event({ patient_id: "patient-2" }), f)
    ).toBe(false);
  });

  it("event_type multi-select: empty matches all, non-empty restricts", () => {
    expect(auditEventMatchesFilters(event({}), base)).toBe(true);
    const f = {
      ...base,
      eventTypes: ["staff.signed_in", "message.sent_to_patient"],
    };
    expect(auditEventMatchesFilters(event({}), f)).toBe(false);
    expect(
      auditEventMatchesFilters(
        event({ event_type: "staff.signed_in" }),
        f
      )
    ).toBe(true);
  });

  it("combined filters: all conditions must hold (AND)", () => {
    const f: AuditFilters = {
      ...base,
      actorStaffId: "staff-1",
      patientId: "patient-1",
      eventTypes: ["patient.created"],
    };
    expect(auditEventMatchesFilters(event({}), f)).toBe(true);
    // one mismatch ⇒ excluded
    expect(
      auditEventMatchesFilters(event({ patient_id: "patient-X" }), f)
    ).toBe(false);
  });
});

describe("summarizeAuditEvent", () => {
  const ev = (over: Partial<AuditEventLike>): AuditEventLike => ({
    created_at: "2026-05-15T10:00:00Z",
    actor_staff_id: "s1",
    event_type: "patient.medication_added",
    patient_id: "p1",
    old_value: null,
    new_value: null,
    ...over,
  });

  it('"Created" when only new_value is present', () => {
    expect(summarizeAuditEvent(ev({ new_value: { a: 1 } }))).toBe("Created");
  });
  it('"Edited" when both old and new are present', () => {
    expect(
      summarizeAuditEvent(ev({ old_value: { a: 1 }, new_value: { a: 2 } }))
    ).toBe("Edited (before → after)");
  });
  it("recognises audit self-events and sign-in/out", () => {
    expect(summarizeAuditEvent(ev({ event_type: "audit.viewed" }))).toBe(
      "Viewed audit log"
    );
    expect(
      summarizeAuditEvent(ev({ event_type: "staff.signed_in" }))
    ).toBe("Signed in");
  });
});

describe("auditEventsToCsv — export matches the filtered rows", () => {
  const rows: AuditCsvRow[] = [
    {
      created_at: "2026-05-15T10:00:00Z",
      actor_name: "Dr Maria Chen",
      actor_role: "surgeon",
      event_type: "patient.created",
      patient_name: "Test Patient One",
      entity_type: "patient",
      entity_id: "p1",
      summary: "Created",
    },
    {
      created_at: "2026-05-15T11:00:00Z",
      actor_name: "Dr Jonathan Nguyen",
      actor_role: "surgeon",
      event_type: "message.sent_to_patient",
      patient_name: "Test Patient Two",
      entity_type: "message",
      entity_id: "m1",
      summary: "Created",
    },
  ];

  it("emits a header row plus one line per filtered row", () => {
    const csv = auditEventsToCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain("created_at");
    expect(lines[0]).toContain("summary");
  });

  it("contains exactly the rows passed in (same set as the UI)", () => {
    const csv = auditEventsToCsv(rows);
    expect(csv).toContain("Dr Maria Chen");
    expect(csv).toContain("Test Patient Two");
    expect(csv).toContain("message.sent_to_patient");
  });

  it("an empty filtered set produces just the header", () => {
    const csv = auditEventsToCsv([]);
    expect(csv.split("\r\n")).toHaveLength(1);
  });

  it("escapes embedded quotes and commas (RFC 4180)", () => {
    const csv = auditEventsToCsv([
      {
        created_at: "2026-05-15T10:00:00Z",
        actor_name: 'Weird, "quoted" name',
        actor_role: "nurse",
        event_type: "patient.note_added",
        patient_name: null,
        entity_type: "staff_note",
        entity_id: "n1",
        summary: "Created",
      },
    ]);
    // Internal quotes doubled; whole cell wrapped.
    expect(csv).toContain('"Weird, ""quoted"" name"');
  });
});

import { describe, expect, it } from "vitest";

import {
  auditEventsToCsv,
  auditRowMatches,
  canAccessAuditLog,
  coerceAuditCategory,
  summarizeAuditEvent,
  type AuditCsvRow,
  type AuditEventLike,
  type AuditRowLike,
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

describe("coerceAuditCategory", () => {
  it("keeps a valid category key", () => {
    expect(coerceAuditCategory("record_edits")).toBe("record_edits");
    expect(coerceAuditCategory("manual_flags")).toBe("manual_flags");
  });
  it("falls back to 'all' for anything unrecognised", () => {
    expect(coerceAuditCategory("nonsense")).toBe("all");
    expect(coerceAuditCategory(undefined)).toBe("all");
    expect(coerceAuditCategory(null)).toBe("all");
  });
});

describe("auditRowMatches — shared table + export filter", () => {
  const row = (over: Partial<AuditRowLike>): AuditRowLike => ({
    event_type: "patient.created",
    actor_name: "Dr Maria Chen",
    patient_name: "Test Patient One",
    ...over,
  });

  it("category 'all' with no query matches every row", () => {
    expect(auditRowMatches(row({}), "all", "")).toBe(true);
    expect(
      auditRowMatches(row({ event_type: "staff.signed_in" }), "all", "")
    ).toBe(true);
  });

  it("a category chip restricts to that category", () => {
    // patient.created buckets to record_edits.
    expect(auditRowMatches(row({}), "record_edits", "")).toBe(true);
    expect(auditRowMatches(row({}), "message_activity", "")).toBe(false);
  });

  it("the search query matches actor name, patient name and event", () => {
    expect(auditRowMatches(row({}), "all", "maria")).toBe(true);
    expect(auditRowMatches(row({}), "all", "patient one")).toBe(true);
    expect(auditRowMatches(row({}), "all", "created")).toBe(true);
    expect(auditRowMatches(row({}), "all", "no-such-thing")).toBe(false);
  });

  it("category and query must both hold (AND)", () => {
    expect(auditRowMatches(row({}), "record_edits", "maria")).toBe(true);
    expect(auditRowMatches(row({}), "message_activity", "maria")).toBe(false);
    expect(auditRowMatches(row({}), "record_edits", "nobody")).toBe(false);
  });

  it("tolerates null actor / patient names", () => {
    const r = row({ actor_name: null, patient_name: null });
    expect(auditRowMatches(r, "all", "")).toBe(true);
    expect(auditRowMatches(r, "all", "maria")).toBe(false);
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

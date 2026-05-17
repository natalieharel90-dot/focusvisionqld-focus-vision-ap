// Pure helpers for the Audit log viewer (/audit). Kept free of DB / React
// imports so the role-gating, filtering, summary, and CSV logic are
// directly unit-testable.

export const AUDIT_PAGE_SIZE = 20;
export const AUDIT_EXPORT_CAP = 5000;

// ── Categories ─────────────────────────────────────────────────────────────

export type AuditCategory =
  | "all"
  | "patient_access"
  | "record_edits"
  | "message_activity"
  | "manual_flags"
  | "system_actions";

export const AUDIT_CATEGORIES: ReadonlyArray<{
  key: AuditCategory;
  label: string;
}> = [
  { key: "all", label: "All events" },
  { key: "patient_access", label: "Patient access" },
  { key: "record_edits", label: "Record edits" },
  { key: "message_activity", label: "Message activity" },
  { key: "manual_flags", label: "Manual flags" },
  { key: "system_actions", label: "System actions" },
];

// Buckets an event type into one of the audit categories.
export function auditCategory(
  eventType: string
): Exclude<AuditCategory, "all"> {
  if (
    eventType === "patient.check_in_reviewed" ||
    eventType === "patient.document_viewed"
  ) {
    return "patient_access";
  }
  if (
    eventType === "patient.flag_raised" ||
    eventType === "patient.flag_resolved"
  ) {
    return "manual_flags";
  }
  if (eventType.startsWith("message.") || eventType === "bulkpush.sent") {
    return "message_activity";
  }
  if (eventType.startsWith("patient.")) return "record_edits";
  return "system_actions";
}

const AUDIT_EVENT_LABELS: Record<string, string> = {
  "staff.signed_in": "Signed in",
  "staff.signed_out": "Signed out",
  "staff.created": "Staff added",
  "message.sent_to_patient": "Message sent",
  "message.thread_resolved": "Thread resolved",
  "bulkpush.sent": "Bulk push sent",
  "patient.created": "Patient created",
  "patient.details_updated": "Record edited",
  "patient.note_added": "Internal note",
  "patient.flag_raised": "Manual flag",
  "patient.flag_resolved": "Flag resolved",
  "patient.check_in_reviewed": "Check-in reviewed",
  "patient.document_viewed": "Document viewed",
  "patient.medication_added": "Medication added",
  "patient.medication_stopped": "Medication stopped",
  "patient.procedure_added": "Procedure added",
  "patient.appointment_scheduled": "Appointment scheduled",
  "patient.appointment_updated": "Appointment updated",
  "patient.template_applied": "Template applied",
  "patient.activated": "Patient activated",
  "audit.viewed": "Audit log viewed",
  "audit.exported": "Audit log exported",
  "analytics.viewed": "Analytics viewed",
};

// A human-friendly label for an event type — falls back to a humanised
// version of the raw type for anything not explicitly mapped.
export function auditEventLabel(eventType: string): string {
  const known = AUDIT_EVENT_LABELS[eventType];
  if (known) return known;
  return eventType
    .split(/[._]/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Tier 1 = Owner / Admin / Clinical Lead. Only tier 1 may view the audit
// log (server-side gate in middleware + the page).
export function canAccessAuditLog(
  accessTier: number | null | undefined
): boolean {
  return accessTier === 1;
}

// ── Filtering ──────────────────────────────────────────────────────────────

export type AuditRowLike = {
  event_type: string;
  actor_name: string | null;
  patient_name: string | null;
};

// The single filter predicate behind both the on-screen audit table and
// the CSV export — a category chip plus a free-text query matched against
// the actor name, patient name, raw event type and its friendly label.
// Keeping one predicate keeps the export in lockstep with the view.
export function auditRowMatches(
  row: AuditRowLike,
  category: AuditCategory,
  query: string
): boolean {
  if (category !== "all" && auditCategory(row.event_type) !== category) {
    return false;
  }
  const q = query.trim().toLowerCase();
  if (q !== "") {
    const haystack = [
      row.actor_name ?? "",
      row.patient_name ?? "",
      row.event_type,
      auditEventLabel(row.event_type),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

// Coerces a raw search-param value into a valid category (default "all").
export function coerceAuditCategory(value: unknown): AuditCategory {
  return AUDIT_CATEGORIES.some((c) => c.key === value)
    ? (value as AuditCategory)
    : "all";
}

// ── Summary + CSV ──────────────────────────────────────────────────────────

export type AuditEventLike = {
  created_at: string;
  actor_staff_id: string | null;
  event_type: string;
  patient_id: string | null;
  old_value: unknown;
  new_value: unknown;
};

// Short summary shown in the table's Summary column. The full before →
// after JSON lives in the detail drawer.
export function summarizeAuditEvent(event: AuditEventLike): string {
  if (event.event_type === "audit.viewed") return "Viewed audit log";
  if (event.event_type === "audit.exported") return "Exported audit log";
  if (event.event_type.endsWith("signed_in")) return "Signed in";
  if (event.event_type.endsWith("signed_out")) return "Signed out";
  const hasOld = event.old_value != null;
  const hasNew = event.new_value != null;
  if (hasOld && hasNew) return "Edited (before → after)";
  if (!hasOld && hasNew) return "Created";
  if (hasOld && !hasNew) return "Removed";
  return "—";
}

// CSV escaping per RFC 4180 — wrap in quotes, double internal quotes.
function csvCell(value: unknown): string {
  const s =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export type AuditCsvRow = {
  created_at: string;
  actor_name: string | null;
  actor_role: string | null;
  event_type: string;
  patient_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
};

const CSV_HEADERS: ReadonlyArray<keyof AuditCsvRow> = [
  "created_at",
  "actor_name",
  "actor_role",
  "event_type",
  "patient_name",
  "entity_type",
  "entity_id",
  "summary",
];

// Serialize the currently-filtered rows to CSV. Same rows the UI shows —
// the caller passes exactly the filtered set.
export function auditEventsToCsv(rows: ReadonlyArray<AuditCsvRow>): string {
  const header = CSV_HEADERS.map((h) => csvCell(h)).join(",");
  const body = rows.map((row) =>
    CSV_HEADERS.map((h) => csvCell(row[h])).join(",")
  );
  return [header, ...body].join("\r\n");
}

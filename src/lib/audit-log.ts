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

// Event types offered in the filter multi-select.
export const AUDIT_EVENT_TYPES: ReadonlyArray<string> = [
  "staff.signed_in",
  "staff.signed_out",
  "staff.created",
  "patient.created",
  "patient.procedure_added",
  "patient.medication_added",
  "patient.medication_stopped",
  "patient.appointment_scheduled",
  "patient.note_added",
  "patient.flag_raised",
  "patient.flag_resolved",
  "patient.check_in_reviewed",
  "patient.template_applied",
  "message.sent_to_patient",
  "settings.routing_rules_updated",
  "settings.alert_actions_updated",
  "settings.symptom_added",
  "settings.symptom_toggled",
  "settings.template_created",
  "settings.template_updated",
  "settings.template_archived",
  "settings.recovery_guidance_updated",
  "audit.viewed",
  "audit.exported",
];

export type AuditFilters = {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive (interpreted as end-of-day)
  actorStaffId: string | null;
  patientId: string | null;
  eventTypes: string[]; // empty ⇒ all
  page: number; // 1-based
};

// Default date window: the last 7 days (today inclusive).
export function defaultDateRange(now: Date = new Date()): {
  from: string;
  to: string;
} {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 7);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

type RawParam = string | string[] | undefined;

function firstString(v: RawParam): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function stringList(v: RawParam): string[] {
  if (Array.isArray(v)) return v.filter((x) => x.length > 0);
  if (typeof v === "string" && v.length > 0) return v.split(",").filter(Boolean);
  return [];
}

// Parse Next.js searchParams into a normalized filter object.
export function parseAuditFilters(
  sp: Record<string, RawParam>,
  now: Date = new Date()
): AuditFilters {
  const def = defaultDateRange(now);
  const pageRaw = Number(firstString(sp.page));
  return {
    from: firstString(sp.from) || def.from,
    to: firstString(sp.to) || def.to,
    actorStaffId: firstString(sp.actor) || null,
    patientId: firstString(sp.patient) || null,
    eventTypes: stringList(sp.events),
    page: Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
  };
}

// Inclusive UTC bounds for a YYYY-MM-DD filter range.
export function filterDateBounds(filters: Pick<AuditFilters, "from" | "to">): {
  fromIso: string;
  toIso: string;
} {
  return {
    fromIso: `${filters.from}T00:00:00.000Z`,
    toIso: `${filters.to}T23:59:59.999Z`,
  };
}

export type AuditEventLike = {
  created_at: string;
  actor_staff_id: string | null;
  event_type: string;
  patient_id: string | null;
  old_value: unknown;
  new_value: unknown;
};

// Pure predicate mirroring the server-side SQL query semantics. Used by
// tests to assert filter combinations select the expected rows.
export function auditEventMatchesFilters(
  event: AuditEventLike,
  filters: AuditFilters
): boolean {
  const ts = new Date(event.created_at).getTime();
  const { fromIso, toIso } = filterDateBounds(filters);
  if (ts < new Date(fromIso).getTime()) return false;
  if (ts > new Date(toIso).getTime()) return false;
  if (filters.actorStaffId && event.actor_staff_id !== filters.actorStaffId) {
    return false;
  }
  if (filters.patientId && event.patient_id !== filters.patientId) {
    return false;
  }
  if (
    filters.eventTypes.length > 0 &&
    !filters.eventTypes.includes(event.event_type)
  ) {
    return false;
  }
  return true;
}

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

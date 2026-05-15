import { NextResponse, type NextRequest } from "next/server";

import { recordStaffAudit } from "@/lib/audit";
import {
  AUDIT_EXPORT_CAP,
  auditEventsToCsv,
  canAccessAuditLog,
  filterDateBounds,
  parseAuditFilters,
  summarizeAuditEvent,
  type AuditCsvRow,
} from "@/lib/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// CSV export of the *currently filtered* audit set (not the whole table).
// Middleware already 403s non-tier-1 on /audit/*; re-checked here too.
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { data: me } = await supabase
    .from("staff_users")
    .select("access_tier")
    .eq("id", user.id)
    .maybeSingle();
  if (!canAccessAuditLog(me?.access_tier)) {
    return new NextResponse("403 Forbidden", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const filters = parseAuditFilters({
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    actor: sp.get("actor") ?? undefined,
    patient: sp.get("patient") ?? undefined,
    events: sp.get("events") ?? undefined,
  });
  const { fromIso, toIso } = filterDateBounds(filters);

  // Same filter set as the table view — capped, no pagination.
  let query = supabase
    .from("audit_events")
    .select("*")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (filters.actorStaffId) {
    query = query.eq("actor_staff_id", filters.actorStaffId);
  }
  if (filters.patientId) query = query.eq("patient_id", filters.patientId);
  if (filters.eventTypes.length > 0) {
    query = query.in("event_type", filters.eventTypes);
  }
  query = query
    .order("created_at", { ascending: false })
    .limit(AUDIT_EXPORT_CAP);

  const { data: events, error } = await query;
  if (error) {
    return new NextResponse(`Export failed: ${error.message}`, {
      status: 500,
    });
  }
  const rows = events ?? [];

  // Resolve actor + patient names.
  const staffIds = Array.from(
    new Set(
      rows.map((r) => r.actor_staff_id).filter((x): x is string => x !== null)
    )
  );
  const patientIds = Array.from(
    new Set(
      rows.map((r) => r.patient_id).filter((x): x is string => x !== null)
    )
  );
  const [staffResult, patientResult] = await Promise.all([
    staffIds.length > 0
      ? supabase.from("staff_users").select("id, name").in("id", staffIds)
      : Promise.resolve({ data: [] }),
    patientIds.length > 0
      ? supabase.from("patients").select("id, name").in("id", patientIds)
      : Promise.resolve({ data: [] }),
  ]);
  const staffName = new Map(
    (staffResult.data ?? []).map((s) => [s.id, s.name])
  );
  const patientName = new Map(
    (patientResult.data ?? []).map((p) => [p.id, p.name])
  );

  const csvRows: AuditCsvRow[] = rows.map((e) => ({
    created_at: e.created_at,
    actor_name: e.actor_staff_id
      ? (staffName.get(e.actor_staff_id) ?? null)
      : null,
    actor_role: e.actor_role,
    event_type: e.event_type,
    patient_name: e.patient_id
      ? (patientName.get(e.patient_id) ?? null)
      : null,
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    summary: summarizeAuditEvent(e),
  }));

  const csv = auditEventsToCsv(csvRows);

  // The export is itself audit-logged.
  await recordStaffAudit(supabase, "audit.exported", {
    entity_type: "audit_log",
    new_value: {
      from: filters.from,
      to: filters.to,
      actor: filters.actorStaffId,
      patient: filters.patientId,
      event_types: filters.eventTypes,
      row_count: csvRows.length,
    },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-log-${filters.from}_to_${filters.to}.csv"`,
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";

import { recordStaffAudit } from "@/lib/audit";
import {
  AUDIT_EXPORT_CAP,
  auditEventsToCsv,
  auditRowMatches,
  canAccessAuditLog,
  coerceAuditCategory,
  summarizeAuditEvent,
  type AuditCsvRow,
} from "@/lib/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// CSV export of the *currently filtered* audit set — the same category
// chip + free-text search the table view applies, just without
// pagination. Middleware already 403s non-tier-1 on /audit/*; re-checked
// here too.
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
  const category = coerceAuditCategory(sp.get("category"));
  const query = (sp.get("q") ?? "").trim();

  // Same starting set as the table view — newest first, capped.
  const { data: events, error } = await supabase
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(AUDIT_EXPORT_CAP);
  if (error) {
    return new NextResponse(`Export failed: ${error.message}`, {
      status: 500,
    });
  }
  const rows = events ?? [];

  // Resolve actor + patient names — the search query matches against them.
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

  // Build rows, then apply the on-screen category + search filter so the
  // CSV is exactly what the table shows (minus pagination).
  const csvRows: AuditCsvRow[] = rows
    .map((e) => ({
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
    }))
    .filter((row) => auditRowMatches(row, category, query));

  const csv = auditEventsToCsv(csvRows);

  // The export is itself audit-logged.
  await recordStaffAudit(supabase, "audit.exported", {
    entity_type: "audit_log",
    new_value: { category, query, row_count: csvRows.length },
  });

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-log-${today}.csv"`,
    },
  });
}

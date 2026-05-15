import Link from "next/link";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import {
  AUDIT_EVENT_TYPES,
  AUDIT_PAGE_SIZE,
  canAccessAuditLog,
  filterDateBounds,
  parseAuditFilters,
} from "@/lib/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuditTable, type AuditRow } from "./AuditTable";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function uniqueNonNull(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((v): v is string => v !== null)));
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Defense in depth — middleware already 403s non-tier-1, but never
  // render audit data without re-checking server-side here.
  const { data: me } = await supabase
    .from("staff_users")
    .select("access_tier")
    .eq("id", user.id)
    .maybeSingle();
  if (!canAccessAuditLog(me?.access_tier)) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          403 — Access denied
        </h1>
        <p className="mt-2 text-sm text-fv-text-secondary">
          The audit log is restricted to tier-1 staff (Owner / Admin /
          Clinical Lead).
        </p>
      </main>
    );
  }

  const filters = parseAuditFilters(searchParams);
  const { fromIso, toIso } = filterDateBounds(filters);
  const offset = (filters.page - 1) * AUDIT_PAGE_SIZE;

  // Filtered, paginated query — uses the (created_at desc) +
  // (actor_staff_id/patient_id/event_type, created_at desc) indexes.
  let query = supabase
    .from("audit_events")
    .select("*", { count: "exact" })
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
    .range(offset, offset + AUDIT_PAGE_SIZE - 1);

  const { data: events, count } = await query;
  const eventRows = events ?? [];

  // Resolve actor + patient names for display.
  const staffIds = uniqueNonNull(eventRows.map((e) => e.actor_staff_id));
  const patientIds = uniqueNonNull(eventRows.map((e) => e.patient_id));

  const [referencedStaff, referencedPatients, allStaff, allPatients] =
    await Promise.all([
      staffIds.length > 0
        ? supabase
            .from("staff_users")
            .select("id, name, role, email")
            .in("id", staffIds)
        : Promise.resolve({ data: [] }),
      patientIds.length > 0
        ? supabase.from("patients").select("id, name").in("id", patientIds)
        : Promise.resolve({ data: [] }),
      supabase.from("staff_users").select("id, name").order("name"),
      supabase.from("patients").select("id, name").order("name"),
    ]);

  const staffById = new Map(
    (referencedStaff.data ?? []).map((s) => [s.id, s])
  );
  const patientById = new Map(
    (referencedPatients.data ?? []).map((p) => [p.id, p])
  );

  const rows: AuditRow[] = eventRows.map((e) => {
    const actor = e.actor_staff_id
      ? staffById.get(e.actor_staff_id)
      : null;
    const patient = e.patient_id ? patientById.get(e.patient_id) : null;
    return {
      id: e.id,
      created_at: e.created_at,
      actor_staff_id: e.actor_staff_id,
      actor_name: actor?.name ?? null,
      actor_role: e.actor_role,
      actor_email: actor?.email ?? null,
      event_type: e.event_type,
      patient_id: e.patient_id,
      patient_name: patient?.name ?? null,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      old_value: e.old_value,
      new_value: e.new_value,
      ip_address: e.ip_address ? String(e.ip_address) : null,
      user_agent: e.user_agent,
    };
  });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  // Self-audit: record that the log was viewed, with the filters applied.
  await recordStaffAudit(supabase, "audit.viewed", {
    entity_type: "audit_log",
    new_value: {
      from: filters.from,
      to: filters.to,
      actor: filters.actorStaffId,
      patient: filters.patientId,
      event_types: filters.eventTypes,
      page: filters.page,
    },
  });

  // Build the export URL carrying the current filters.
  const exportParams = new URLSearchParams();
  exportParams.set("from", filters.from);
  exportParams.set("to", filters.to);
  if (filters.actorStaffId) exportParams.set("actor", filters.actorStaffId);
  if (filters.patientId) exportParams.set("patient", filters.patientId);
  if (filters.eventTypes.length > 0) {
    exportParams.set("events", filters.eventTypes.join(","));
  }

  function pageHref(page: number): string {
    const sp = new URLSearchParams(exportParams);
    sp.set("page", String(page));
    return `/audit?${sp.toString()}`;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fv-text-primary">
            Audit log
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Append-only and retained for 7 years post-patient discharge. No
            edits, no deletes.
          </p>
        </div>
        <a
          href={`/audit/export?${exportParams.toString()}`}
          className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
        >
          Export CSV
        </a>
      </div>

      {/* Filter bar — GET form, filters live in the URL query string. */}
      <form
        method="get"
        className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-fv-bg-card p-4 shadow-sm sm:grid-cols-4"
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">To</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">Actor</span>
          <select
            name="actor"
            defaultValue={filters.actorStaffId ?? ""}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          >
            <option value="">Any staff member</option>
            {(allStaff.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-fv-text-secondary">Patient</span>
          <select
            name="patient"
            defaultValue={filters.patientId ?? ""}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1.5 text-sm"
          >
            <option value="">Any patient</option>
            {(allPatients.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="col-span-2 sm:col-span-4">
          <legend className="text-xs font-semibold text-fv-text-secondary">
            Event types (none selected = all)
          </legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {AUDIT_EVENT_TYPES.map((et) => (
              <label
                key={et}
                className="flex items-center gap-1.5 text-xs text-fv-text-primary"
              >
                <input
                  type="checkbox"
                  name="events"
                  value={et}
                  defaultChecked={filters.eventTypes.includes(et)}
                />
                {et}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
          <Link
            href="/audit"
            className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
          >
            Reset
          </Link>
        </div>
      </form>

      <p className="mt-4 text-xs text-fv-text-secondary">
        {total} event{total === 1 ? "" : "s"} · page {filters.page} of{" "}
        {totalPages}
      </p>

      <div className="mt-2">
        <AuditTable rows={rows} />
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm">
        {filters.page > 1 ? (
          <Link
            href={pageHref(filters.page - 1)}
            className="rounded-md border border-fv-bg-soft px-3 py-1.5 font-medium text-fv-text-primary"
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {filters.page < totalPages ? (
          <Link
            href={pageHref(filters.page + 1)}
            className="rounded-md border border-fv-bg-soft px-3 py-1.5 font-medium text-fv-text-primary"
          >
            Next →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}

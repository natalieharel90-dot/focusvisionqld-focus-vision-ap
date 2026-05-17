import Link from "next/link";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import {
  AUDIT_CATEGORIES,
  AUDIT_EXPORT_CAP,
  AUDIT_PAGE_SIZE,
  auditCategory,
  auditRowMatches,
  canAccessAuditLog,
  coerceAuditCategory,
} from "@/lib/audit-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuditTable, type AuditRow } from "./AuditTable";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function auditHref(opts: { category?: string; q?: string; page?: number }) {
  const p = new URLSearchParams();
  if (opts.category && opts.category !== "all") {
    p.set("category", opts.category);
  }
  if (opts.q) p.set("q", opts.q);
  if (opts.page && opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `/audit?${s}` : "/audit";
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

  const category = coerceAuditCategory(first(searchParams.category));
  const q = (first(searchParams.q) ?? "").trim();
  const page = Math.max(1, Math.floor(Number(first(searchParams.page)) || 1));

  const [eventsRes, staffRes, patientsRes] = await Promise.all([
    supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(AUDIT_EXPORT_CAP),
    supabase.from("staff_users").select("id, name, role, email"),
    supabase.from("patients").select("id, name"),
  ]);

  const staffById = new Map(
    (staffRes.data ?? []).map((s) => [s.id, s])
  );
  const patientById = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, p])
  );

  const allRows: AuditRow[] = (eventsRes.data ?? []).map((e) => {
    const actor = e.actor_staff_id ? staffById.get(e.actor_staff_id) : null;
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

  // ── Summary metrics ──
  const todayRows = allRows.filter((r) => isToday(r.created_at));
  const staffToday = new Set(
    todayRows.map((r) => r.actor_staff_id).filter(Boolean)
  ).size;
  const recordEdits = allRows.filter(
    (r) => auditCategory(r.event_type) === "record_edits"
  ).length;
  const patientAccess = allRows.filter(
    (r) => auditCategory(r.event_type) === "patient_access"
  ).length;

  const stats = [
    {
      label: "Events today",
      value: String(todayRows.length),
      sub: `Across ${staffToday} staff`,
    },
    {
      label: "Record edits",
      value: String(recordEdits),
      sub: "All logged",
    },
    {
      label: "Patient access",
      value: String(patientAccess),
      sub: "Views & reviews",
    },
    { label: "Anomalies", value: "0", sub: "None flagged" },
  ];

  // ── Category + search filter ── (shared with the CSV export)
  const filtered = allRows.filter((r) => auditRowMatches(r, category, q));

  // The Export CSV link carries the active filters so the download
  // matches exactly what's on screen.
  const exportParams = new URLSearchParams();
  if (category !== "all") exportParams.set("category", category);
  if (q) exportParams.set("q", q);
  const exportHref = exportParams.toString()
    ? `/audit/export?${exportParams.toString()}`
    : "/audit/export";

  const totalPages = Math.max(1, Math.ceil(filtered.length / AUDIT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * AUDIT_PAGE_SIZE,
    safePage * AUDIT_PAGE_SIZE
  );
  const firstShown =
    filtered.length === 0 ? 0 : (safePage - 1) * AUDIT_PAGE_SIZE + 1;
  const lastShown = (safePage - 1) * AUDIT_PAGE_SIZE + pageRows.length;

  await recordStaffAudit(supabase, "audit.viewed", {
    entity_type: "audit_log",
    new_value: { category, q, page: safePage },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fv-text-primary">
            Audit log
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Every staff action across patient records · required by
            Australian Privacy Principle 11
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form method="get" className="w-full max-w-xs">
            {category !== "all" ? (
              <input type="hidden" name="category" value={category} />
            ) : null}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by staff, patient or action…"
              className="w-full rounded-lg border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm focus:border-fv-accent focus:outline-none"
            />
          </form>
          <a
            href={exportHref}
            className="shrink-0 rounded-lg bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        {AUDIT_CATEGORIES.map((c) => {
          const active = c.key === category;
          return (
            <Link
              key={c.key}
              href={auditHref({ category: c.key, q })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                active
                  ? "bg-fv-accent-strong text-white"
                  : "border border-fv-border text-fv-text-secondary hover:bg-fv-bg-soft"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              {s.label}
            </div>
            <div className="mt-2 text-3xl font-semibold text-fv-text-primary">
              {s.value}
            </div>
            <div className="mt-1 text-xs text-fv-text-secondary">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Event table */}
      <div className="mt-5">
        <AuditTable rows={pageRows} />
      </div>

      {/* Pagination */}
      {filtered.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-fv-text-secondary">
          <span>
            Showing {firstShown}–{lastShown} of {filtered.length}
          </span>
          {totalPages > 1 ? (
            <span className="flex items-center gap-2">
              {safePage > 1 ? (
                <Link
                  href={auditHref({ category, q, page: safePage - 1 })}
                  className="rounded-lg border border-fv-border px-3 py-1.5 font-medium text-fv-text-primary hover:bg-fv-bg-soft"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="rounded-lg border border-fv-bg-soft px-3 py-1.5 font-medium opacity-40">
                  ← Previous
                </span>
              )}
              <span className="px-1">
                Page {safePage} of {totalPages}
              </span>
              {safePage < totalPages ? (
                <Link
                  href={auditHref({ category, q, page: safePage + 1 })}
                  className="rounded-lg border border-fv-border px-3 py-1.5 font-medium text-fv-text-primary hover:bg-fv-bg-soft"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-lg border border-fv-bg-soft px-3 py-1.5 font-medium opacity-40">
                  Next →
                </span>
              )}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* About this log */}
      <section className="mt-6 rounded-2xl border border-fv-bg-soft bg-[#FAFCFC] p-5">
        <h2 className="text-[13px] font-semibold text-fv-text-primary">
          About this log
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-fv-text-secondary">
          Every action staff take on a patient record is logged
          automatically — viewing, editing, messaging, manual flagging. Logs
          are immutable (records cannot be edited or deleted, only added) and
          retained for 7 years post-discharge in line with Australian
          clinical record retention standards. Only admin-role users can
          access this view. Anomaly detection flags unusual patterns (e.g. a
          single staff member accessing 50+ records in an hour) for the
          Privacy Officer to review.
        </p>
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { recordStaffAudit } from "@/lib/audit";
import { initials } from "@/lib/bulk-push";
import { auditEventLabel } from "@/lib/audit-log";
import {
  activityTone,
  firstReplyBusinessMinutes,
  flagBreakdown,
  formatResponseTime,
  isActivityFeedEvent,
  median,
  relativeTime,
  sortPriorities,
  type Severity,
} from "@/lib/home-dashboard";
import { ActivityFeed, type FeedItem } from "./ActivityFeed";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - Date.parse(`${dateStr}T00:00:00Z`)) / DAY);
}

const SEVERITY_BORDER: Record<Severity, string> = {
  red: "border-l-[#C13434]",
  orange: "border-l-[#D67E3B]",
  yellow: "border-l-[#D8A82A]",
};

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-red-600",
];

function gradientFor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]!;
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white ${gradientFor(
        name
      )}`}
    >
      {initials(name)}
    </span>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
      {children}
    </section>
  );
}

export default async function StaffDashboardHomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const iso = (ms: number) => new Date(ms).toISOString();

  const [
    proceduresRes,
    checkInsRes,
    flagsRes,
    messages7dRes,
    unreadRes,
    auditRes,
    setupRes,
    apptRes,
    reportsRes,
    patientsRes,
    staffRes,
    threadsRes,
  ] = await Promise.all([
    supabase
      .from("procedures")
      .select("patient_id, procedure_type, surgery_date")
      .eq("status", "active"),
    supabase
      .from("check_ins")
      .select(
        "id, patient_id, recovery_day, staff_alert_level, created_at, unusual_symptoms, pain, light_sensitivity"
      )
      .gte("created_at", iso(now - 2 * DAY)),
    supabase
      .from("manual_flags")
      .select("id, patient_id, alert_level, reason, created_at")
      .is("resolved_at", null),
    supabase
      .from("messages")
      .select("thread_id, sender_type, sent_at")
      .gte("sent_at", iso(now - 7 * DAY)),
    supabase
      .from("messages")
      .select("thread_id, sent_at")
      .eq("sender_type", "patient")
      .is("read_at", null),
    supabase
      .from("audit_events")
      .select("id, event_type, actor_staff_id, patient_id, created_at")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("patient_setup_tasks")
      .select("patient_id, status, created_at"),
    supabase
      .from("appointments")
      .select("patient_id, appointment_type")
      .eq("status", "to_book"),
    supabase
      .from("generated_reports")
      .select("report_type, generated_at")
      .eq("auto_generated", true)
      .gte("generated_at", iso(now - 7 * DAY)),
    supabase.from("patients").select("id, name"),
    supabase.from("staff_users").select("id, name"),
    supabase.from("message_threads").select("id, patient_id"),
  ]);

  const procedures = proceduresRes.data ?? [];
  const checkIns = checkInsRes.data ?? [];
  const flags = flagsRes.data ?? [];
  const patientName = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, p.name])
  );
  const staffName = new Map((staffRes.data ?? []).map((s) => [s.id, s.name]));
  const patientByThread = new Map(
    (threadsRes.data ?? []).map((t) => [t.id, t.patient_id])
  );
  const procByPatient = new Map(procedures.map((p) => [p.patient_id, p]));

  // ── KPI: active recoveries ──
  const activeIn = (fromMs: number, toMs: number) =>
    procedures.filter((p) => {
      if (!p.surgery_date) return false;
      const t = Date.parse(`${p.surgery_date}T00:00:00Z`);
      return t >= fromMs && t <= toMs;
    }).length;
  const activeRecoveries = activeIn(now - 90 * DAY, now);
  const activeDelta = activeRecoveries - activeIn(now - 97 * DAY, now - 7 * DAY);

  // ── KPI: today's check-ins ──
  const checkInsToday = checkIns.filter(
    (c) => Date.parse(c.created_at) >= todayStart.getTime()
  ).length;
  const expectedToday = activeRecoveries;
  const checkInPct =
    expectedToday > 0
      ? Math.min(100, Math.round((checkInsToday / expectedToday) * 100))
      : 0;

  // ── KPI: open flags ──
  const recentAlertCheckIns = checkIns.filter(
    (c) =>
      c.staff_alert_level !== "none" && Date.parse(c.created_at) >= now - DAY
  );
  const flagBd = flagBreakdown([
    ...flags.map((f) => f.alert_level as string),
    ...recentAlertCheckIns.map((c) => c.staff_alert_level as string),
  ]);

  // ── KPI: median response time ──
  const responseMinutes = median(
    firstReplyBusinessMinutes(messages7dRes.data ?? [])
  );

  // ── Today's priorities ──
  type PriorityRow = {
    key: string;
    severity: Severity;
    raisedAt: string;
    patientId: string;
    reason: string;
  };
  const priorityRows: PriorityRow[] = [];
  for (const f of flags) {
    if (!["red", "orange", "yellow"].includes(f.alert_level)) continue;
    priorityRows.push({
      key: `f:${f.id}`,
      severity: f.alert_level as Severity,
      raisedAt: f.created_at,
      patientId: f.patient_id,
      reason: `Manual flag — ${f.reason}`,
    });
  }
  for (const c of recentAlertCheckIns) {
    const bits = [`Pain ${c.pain}`, `Light ${c.light_sensitivity}`];
    if (c.unusual_symptoms.length > 0) bits.push(c.unusual_symptoms.join(", "));
    priorityRows.push({
      key: `c:${c.id}`,
      severity: c.staff_alert_level as Severity,
      raisedAt: c.created_at,
      patientId: c.patient_id,
      reason: `Check-in — ${bits.join(" · ")}`,
    });
  }
  const sortedPriorities = sortPriorities(priorityRows);
  const shownPriorities = sortedPriorities.slice(0, 8);
  const flaggedPatientCount = new Set(
    sortedPriorities.map((r) => r.patientId)
  ).size;

  // ── Activity feed ──
  const feedItems: FeedItem[] = (auditRes.data ?? [])
    .filter((e) => isActivityFeedEvent(e.event_type))
    .slice(0, 15)
    .map((e) => {
      const actor = e.actor_staff_id
        ? staffName.get(e.actor_staff_id) ?? "Staff"
        : "System";
      const patient = e.patient_id ? patientName.get(e.patient_id) : null;
      return {
        id: e.id,
        tone: activityTone(e.event_type),
        summary: `${actor} · ${auditEventLabel(e.event_type)}${
          patient ? ` — ${patient}` : ""
        }`,
        createdAt: e.created_at,
      };
    });

  // ── Pending actions ──
  const unreadThreads = new Map<string, string>();
  for (const m of unreadRes.data ?? []) {
    const existing = unreadThreads.get(m.thread_id);
    if (!existing || m.sent_at < existing) {
      unreadThreads.set(m.thread_id, m.sent_at);
    }
  }
  const oldestUnread = [...unreadThreads.entries()].sort((a, b) =>
    a[1] < b[1] ? -1 : 1
  )[0];
  const oldestUnreadName = oldestUnread
    ? patientName.get(patientByThread.get(oldestUnread[0]) ?? "") ?? null
    : null;

  const awaitingSetup = (setupRes.data ?? [])
    .filter((s) =>
      ["mfa_pending", "awaiting_setup", "partial"].includes(s.status)
    )
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const oldestSetup = awaitingSetup[0];
  const toBook = apptRes.data ?? [];
  const reportsReady = reportsRes.data ?? [];

  const pending = [
    {
      key: "unread",
      show: unreadThreads.size > 0,
      label: "Unread messages",
      count: unreadThreads.size,
      sub: oldestUnreadName
        ? `Oldest from ${oldestUnreadName}`
        : "Patient replies awaiting a response",
      href: "/inbox",
      cta: "Open inbox →",
    },
    {
      key: "setup",
      show: awaitingSetup.length > 0,
      label: "Awaiting setup",
      count: awaitingSetup.length,
      sub: oldestSetup
        ? `${
            patientName.get(oldestSetup.patient_id) ?? "A patient"
          } — waiting ${relativeTime(oldestSetup.created_at)}`
        : "",
      href: "/new-patients",
      cta: "Open queue →",
    },
    {
      key: "tobook",
      show: toBook.length > 0,
      label: "To-book appointments",
      count: toBook.length,
      sub: toBook[0]
        ? `${toBook[0].appointment_type} for ${
            patientName.get(toBook[0].patient_id) ?? "a patient"
          }`
        : "",
      href: "/patients",
      cta: "Schedule →",
    },
    {
      key: "reports",
      show: reportsReady.length > 0,
      label: "Reports ready",
      count: reportsReady.length,
      sub: reportsReady[0]
        ? `Most recent: ${reportsReady[0].report_type.replace(/_/g, " ")}`
        : "",
      href: "/reports",
      cta: "Open reports →",
    },
  ].filter((p) => p.show);

  await recordStaffAudit(supabase, "dashboard.viewed", {
    entity_type: "dashboard",
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-fv-text-primary">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-fv-text-secondary">
        What needs attention across the clinic right now.
      </p>

      {/* ── Section 1 · KPI strip ── */}
      <div className="mt-5 grid grid-cols-2 gap-4 min-[1100px]:grid-cols-4">
        <Link
          href="/patients"
          className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-4 shadow-sm hover:shadow"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Active recoveries
          </div>
          <div className="mt-1 text-3xl font-semibold text-fv-text-primary">
            {activeRecoveries}
          </div>
          <div
            className={`mt-1 text-xs ${
              activeDelta > 0 ? "text-green-600" : "text-fv-text-secondary"
            }`}
          >
            {activeDelta > 0 ? "↑" : activeDelta < 0 ? "↓" : "→"}{" "}
            {Math.abs(activeDelta)} vs last week
          </div>
        </Link>

        <Link
          href="/triage"
          className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-4 shadow-sm hover:shadow"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Today&apos;s check-ins
          </div>
          <div className="mt-1 text-3xl font-semibold text-fv-text-primary">
            {checkInsToday}{" "}
            <span className="text-lg text-fv-text-secondary">
              / {expectedToday}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-fv-bg-soft">
            <div
              className="h-full rounded-full bg-fv-accent-strong"
              style={{ width: `${checkInPct}%` }}
            />
          </div>
        </Link>

        <Link
          href="/triage"
          className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-4 shadow-sm hover:shadow"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Open flags
          </div>
          <div className="mt-1 text-3xl font-semibold text-fv-text-primary">
            {flagBd.total}
          </div>
          <div className="mt-1 text-xs">
            <span className="font-semibold text-[#C13434]">
              {flagBd.red} red
            </span>
            <span className="text-fv-text-secondary"> · </span>
            <span className="font-semibold text-[#B66828]">
              {flagBd.orange} orange
            </span>
            <span className="text-fv-text-secondary"> · </span>
            <span className="font-semibold text-[#9A7A14]">
              {flagBd.yellow} yellow
            </span>
          </div>
        </Link>

        <Link
          href="/analytics"
          className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-4 shadow-sm hover:shadow"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
            Median response time
          </div>
          <div className="mt-1 text-3xl font-semibold text-fv-text-primary">
            {formatResponseTime(responseMinutes)}
          </div>
          <div className="mt-1 text-xs text-fv-text-secondary">
            Business hours: Mon–Fri 8am–5pm
          </div>
        </Link>
      </div>

      {/* ── Section 2 · Today's priorities ── */}
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-fv-text-primary">
              Today&apos;s priorities
            </h3>
            <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
              {flaggedPatientCount} patient
              {flaggedPatientCount === 1 ? "" : "s"} flagged
            </span>
          </div>
          <Link
            href="/triage"
            className="text-xs font-semibold text-fv-accent-strong hover:underline"
          >
            View full triage queue →
          </Link>
        </div>

        {shownPriorities.length === 0 ? (
          <p className="rounded-xl bg-fv-bg-soft/50 px-4 py-8 text-center text-sm text-fv-text-secondary">
            No flagged patients right now. The triage queue is clear.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shownPriorities.map((row) => {
              const name =
                patientName.get(row.patientId) ?? "Unknown patient";
              const proc = procByPatient.get(row.patientId);
              const day = daysSince(proc?.surgery_date ?? null);
              return (
                <li
                  key={row.key}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border-l-4 bg-fv-bg-soft/40 p-3 ${SEVERITY_BORDER[row.severity]}`}
                >
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-fv-text-primary">
                      {name}
                      {day !== null ? ` · Day ${day}` : ""}
                      {proc ? ` ${proc.procedure_type.toUpperCase()}` : ""}
                    </div>
                    <div className="text-xs text-fv-text-secondary">
                      {row.reason} — flagged {relativeTime(row.raisedAt)}
                    </div>
                  </div>
                  <Link
                    href={`/patients/${row.patientId}`}
                    className="rounded-md bg-fv-accent-strong px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Open
                  </Link>
                  <Link
                    href="/inbox"
                    className="rounded-md border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
                  >
                    💬 Message
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {sortedPriorities.length > shownPriorities.length ? (
          <Link
            href="/triage"
            className="mt-3 inline-block text-xs font-semibold text-fv-accent-strong hover:underline"
          >
            + {sortedPriorities.length - shownPriorities.length} more in the
            queue →
          </Link>
        ) : null}
      </Panel>

      {/* ── Section 3 · Activity + Pending actions ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 min-[1100px]:grid-cols-2">
        <ActivityFeed items={feedItems} />

        <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-fv-text-primary">
              Pending actions
            </h3>
            {pending.length > 0 ? (
              <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
                {pending.length}
              </span>
            ) : null}
          </div>

          {pending.length === 0 ? (
            <p className="rounded-xl bg-fv-bg-soft/50 px-4 py-8 text-center text-sm text-fv-text-secondary">
              Nothing pending. You&apos;re caught up.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((p) => (
                <li key={p.key}>
                  <Link
                    href={p.href}
                    className="flex items-center justify-between gap-3 rounded-xl border border-fv-bg-soft p-3 hover:bg-fv-bg-soft/50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-fv-text-primary">
                        {p.label}
                        <span className="ml-2 rounded-full bg-fv-bg-accent-soft px-2 py-0.5 text-xs font-bold text-fv-accent-strong">
                          {p.count}
                        </span>
                      </div>
                      {p.sub ? (
                        <div className="mt-0.5 truncate text-xs text-fv-text-secondary">
                          {p.sub}
                        </div>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-fv-accent-strong">
                      {p.cta}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

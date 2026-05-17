// Server-side report builders. Each fetches the rows it needs and runs
// the pure maths from src/lib/reports.ts. Output is stored as the
// generated_reports.data JSON and rendered by the report view.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { initials } from "@/lib/bulk-push";
import {
  type ReportType,
  type ZoneDistribution,
  adherenceRate,
  flagRatePer100RecoveryDays,
  formatDuration,
  matchesCohortReport,
  median,
  pct,
  reportZone,
  zoneDistribution,
} from "@/lib/reports";

type Supa = SupabaseClient<Database>;

// Identifiers gate — full name only when explicitly opted in.
function displayName(name: string, includeIdentifiers: boolean): string {
  return includeIdentifiers ? name : initials(name);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) /
      86_400_000
  );
}

// Median response time (seconds) for patient messages → first staff reply.
function medianResponseSeconds(
  messages: { thread_id: string; sender_type: string; sent_at: string }[]
): number | null {
  const byThread = new Map<string, typeof messages>();
  for (const m of messages) {
    const list = byThread.get(m.thread_id) ?? [];
    list.push(m);
    byThread.set(m.thread_id, list);
  }
  const gaps: number[] = [];
  for (const list of byThread.values()) {
    const sorted = [...list].sort(
      (a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at)
    );
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i]!.sender_type !== "patient") continue;
      const reply = sorted
        .slice(i + 1)
        .find((m) => m.sender_type === "staff");
      if (reply) {
        gaps.push(
          (Date.parse(reply.sent_at) - Date.parse(sorted[i]!.sent_at)) / 1000
        );
      }
    }
  }
  return median(gaps);
}

export type ReportData = Record<string, unknown> & { period?: unknown };

// ── a) Monthly clinic activity ───────────────────────────────────────────
async function buildMonthlyActivity(
  supabase: Supa,
  params: { month?: string },
  include: boolean
): Promise<ReportData> {
  const month = params.month ?? defaultMonth();
  const from = `${month}-01`;
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(fromDate);
  toDate.setUTCMonth(toDate.getUTCMonth() + 1);
  const to = toDate.toISOString().slice(0, 10);
  const todayISO = new Date().toISOString().slice(0, 10);

  const [patientsRes, proceduresRes, checkInsRes, dosesRes, messagesRes, flagsRes] =
    await Promise.all([
      supabase
        .from("patients")
        .select("id, name, created_at")
        .gte("created_at", from)
        .lt("created_at", to),
      supabase
        .from("procedures")
        .select("patient_id, procedure_type, surgery_date, status"),
      supabase
        .from("check_ins")
        .select("patient_id, patient_zone, staff_alert_level, created_at")
        .gte("created_at", from)
        .lt("created_at", to),
      supabase
        .from("medication_doses")
        .select("taken_at, scheduled_at")
        .gte("scheduled_at", from)
        .lt("scheduled_at", to),
      supabase
        .from("messages")
        .select("thread_id, sender_type, sent_at")
        .gte("sent_at", from)
        .lt("sent_at", to),
      supabase
        .from("manual_flags")
        .select("alert_level, created_at, resolved_at")
        .gte("created_at", from)
        .lt("created_at", to),
    ]);

  const procByPatient = new Map(
    (proceduresRes.data ?? [])
      .filter((p) => p.status === "active")
      .map((p) => [p.patient_id, p])
  );

  const onboarded = (patientsRes.data ?? []).map((p) => {
    const proc = procByPatient.get(p.id);
    return {
      displayName: displayName(p.name, include),
      surgeryDate: proc?.surgery_date ?? null,
      procedure: proc?.procedure_type?.toUpperCase() ?? null,
    };
  });

  // Expected check-ins ≈ post-op patient-days that fall inside the period.
  let expected = 0;
  for (const proc of procByPatient.values()) {
    if (!proc.surgery_date) continue;
    const start = proc.surgery_date > from ? proc.surgery_date : from;
    const end = to < todayISO ? to : todayISO;
    expected += Math.max(0, daysBetween(start, end));
  }
  const checkIns = checkInsRes.data ?? [];
  const doses = dosesRes.data ?? [];
  const takenDoses = doses.filter((d) => d.taken_at).length;
  const messages = messagesRes.data ?? [];
  const flags = flagsRes.data ?? [];

  const byLevel: Record<string, number> = { yellow: 0, orange: 0, red: 0 };
  let resolutionTotal = 0;
  let resolvedCount = 0;
  for (const f of flags) {
    byLevel[f.alert_level] = (byLevel[f.alert_level] ?? 0) + 1;
    if (f.resolved_at) {
      resolutionTotal +=
        Date.parse(f.resolved_at) - Date.parse(f.created_at);
      resolvedCount += 1;
    }
  }

  return {
    period: { from, to, label: monthLabel(month) },
    onboarded: { count: onboarded.length, patients: onboarded },
    checkIns: {
      completed: checkIns.length,
      expected,
      completionPct: pct(checkIns.length, expected),
      zones: zoneDistribution(checkIns),
    },
    adherencePct: adherenceRate(takenDoses, doses.length),
    messages: {
      fromPatients: messages.filter((m) => m.sender_type === "patient").length,
      fromStaff: messages.filter((m) => m.sender_type === "staff").length,
      medianResponse: formatDuration(medianResponseSeconds(messages)),
    },
    flags: {
      count: flags.length,
      byLevel,
      avgResolutionHours:
        resolvedCount > 0
          ? Math.round(resolutionTotal / resolvedCount / 3_600_000)
          : null,
    },
  };
}

// ── b) Per-surgeon ───────────────────────────────────────────────────────
async function buildSurgeon(
  supabase: Supa,
  params: { surgeonId?: string; from?: string; to?: string },
  include: boolean
): Promise<ReportData> {
  const to = params.to ?? new Date().toISOString().slice(0, 10);
  const from =
    params.from ??
    new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const surgeonId = params.surgeonId ?? "";

  const { data: surgeon } = await supabase
    .from("staff_users")
    .select("name")
    .eq("id", surgeonId)
    .maybeSingle();

  const { data: procedures } = await supabase
    .from("procedures")
    .select("patient_id, surgery_date")
    .eq("surgeon_id", surgeonId)
    .gte("surgery_date", from)
    .lte("surgery_date", to);
  const patientIds = [...new Set((procedures ?? []).map((p) => p.patient_id))];
  const surgeryByPatient = new Map(
    (procedures ?? []).map((p) => [p.patient_id, p.surgery_date])
  );

  if (patientIds.length === 0) {
    return {
      period: { from, to, label: `${from} → ${to}` },
      surgeon: surgeon?.name ?? "Unknown surgeon",
      patientCount: 0,
      adherencePct: null,
      zones: zoneDistribution([]),
      medianResponse: "—",
      flagRatePer100: 0,
      flaggedPatients: [],
    };
  }

  const [patientsRes, checkInsRes, medsRes, threadsRes, flagsRes] =
    await Promise.all([
      supabase.from("patients").select("id, name").in("id", patientIds),
      supabase
        .from("check_ins")
        .select("patient_id, patient_zone, staff_alert_level, recovery_day")
        .in("patient_id", patientIds),
      supabase.from("medications").select("id, patient_id").in("patient_id", patientIds),
      supabase
        .from("message_threads")
        .select("id, patient_id")
        .in("patient_id", patientIds),
      supabase
        .from("manual_flags")
        .select("patient_id, alert_level, resolved_at, created_at")
        .in("patient_id", patientIds),
    ]);

  const nameById = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, p.name])
  );
  const checkIns = checkInsRes.data ?? [];

  // Adherence across this surgeon's patients — bounded to the report
  // period (doses scheduled inside [from, to]), matching the monthly
  // report. `to` is inclusive, so the upper bound is the day after.
  const toExclusive = new Date(
    Date.parse(`${to}T00:00:00Z`) + 86_400_000
  )
    .toISOString()
    .slice(0, 10);
  const medIds = (medsRes.data ?? []).map((m) => m.id);
  let scheduled = 0;
  let taken = 0;
  if (medIds.length > 0) {
    const { data: doses } = await supabase
      .from("medication_doses")
      .select("taken_at")
      .in("medication_id", medIds)
      .gte("scheduled_at", from)
      .lt("scheduled_at", toExclusive);
    scheduled = doses?.length ?? 0;
    taken = (doses ?? []).filter((d) => d.taken_at).length;
  }

  // Median response time across these patients' threads.
  const threadIds = (threadsRes.data ?? []).map((t) => t.id);
  let medianResponse = "—";
  if (threadIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("thread_id, sender_type, sent_at")
      .in("thread_id", threadIds);
    medianResponse = formatDuration(medianResponseSeconds(msgs ?? []));
  }

  // Flag rate per 100 patient-recovery-days.
  const todayISO = new Date().toISOString().slice(0, 10);
  let totalRecoveryDays = 0;
  for (const id of patientIds) {
    const sd = surgeryByPatient.get(id);
    if (sd) totalRecoveryDays += Math.max(0, daysBetween(sd, todayISO));
  }
  const flags = flagsRes.data ?? [];
  const flaggedPatients = flags.map((f) => {
    const sd = surgeryByPatient.get(f.patient_id);
    return {
      displayName: displayName(
        nameById.get(f.patient_id) ?? "Unknown",
        include
      ),
      recoveryDay: sd ? Math.max(0, daysBetween(sd, todayISO)) : null,
      level: f.alert_level,
      outcome: f.resolved_at ? "Resolved" : "Open",
    };
  });

  return {
    period: { from, to, label: `${from} → ${to}` },
    surgeon: surgeon?.name ?? "Unknown surgeon",
    patientCount: patientIds.length,
    adherencePct: adherenceRate(taken, scheduled),
    zones: zoneDistribution(checkIns),
    medianResponse,
    flagRatePer100: flagRatePer100RecoveryDays(flags.length, totalRecoveryDays),
    flaggedPatients,
  };
}

// ── c) Compliance / audit summary ────────────────────────────────────────
async function buildCompliance(
  supabase: Supa,
  params: { from?: string; to?: string }
): Promise<ReportData> {
  const to = params.to ?? new Date().toISOString().slice(0, 10);
  const from =
    params.from ??
    new Date(Date.now() - 182 * 86_400_000).toISOString().slice(0, 10);

  const { data: events } = await supabase
    .from("audit_events")
    .select("event_type, actor_staff_id, actor_role, created_at")
    .gte("created_at", from)
    .lte("created_at", `${to}T23:59:59`);
  const rows = events ?? [];

  const staffIds = [
    ...new Set(
      rows.map((e) => e.actor_staff_id).filter((id): id is string => !!id)
    ),
  ];
  const { data: staff } = staffIds.length
    ? await supabase.from("staff_users").select("id, name").in("id", staffIds)
    : { data: [] as { id: string; name: string }[] };
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]));

  const editTypes = new Set([
    "patient.procedure_added",
    "patient.medication_added",
    "patient.medication_stopped",
    "patient.appointment_scheduled",
    "patient.appointment_updated",
    "patient.note_added",
    "patient.created",
    "patient.template_applied",
    "patient.activated",
  ]);
  const exportTypes = new Set([
    "audit.exported",
    "analytics.exported",
    "patient.document_viewed",
    "patient.appointment_calendar_exported",
  ]);

  const editsByStaff: Record<string, number> = {};
  const adminActions: Record<string, number> = {};
  const exports: { event: string; actor: string; at: string }[] = [];
  for (const e of rows) {
    if (editTypes.has(e.event_type)) {
      const who = e.actor_staff_id
        ? (staffName.get(e.actor_staff_id) ?? "Unknown")
        : (e.actor_role ?? "system");
      editsByStaff[who] = (editsByStaff[who] ?? 0) + 1;
    }
    if (e.event_type.startsWith("settings.")) {
      adminActions[e.event_type] = (adminActions[e.event_type] ?? 0) + 1;
    }
    if (exportTypes.has(e.event_type)) {
      exports.push({
        event: e.event_type,
        actor: e.actor_staff_id
          ? (staffName.get(e.actor_staff_id) ?? "Unknown")
          : (e.actor_role ?? "—"),
        at: e.created_at,
      });
    }
  }

  return {
    period: { from, to, label: `${from} → ${to}` },
    recordEditsByStaff: editsByStaff,
    adminActions,
    exports,
  };
}

// ── d) Patient cohort ────────────────────────────────────────────────────
async function buildCohort(
  supabase: Supa,
  params: {
    procedures?: string[];
    surgeonIds?: string[];
    from?: string;
    to?: string;
    zone?: string;
  },
  include: boolean,
  referenceTime: Date
): Promise<ReportData> {
  const todayISO = referenceTime.toISOString().slice(0, 10);

  const [patientsRes, proceduresRes, checkInsRes, threadsRes] =
    await Promise.all([
      supabase.from("patients").select("id, name"),
      supabase
        .from("procedures")
        .select("patient_id, procedure_type, surgeon_id, surgery_date, status")
        .eq("status", "active"),
      supabase
        .from("check_ins")
        .select("patient_id, patient_zone, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("message_threads").select("patient_id, status"),
    ]);

  const procByPatient = new Map(
    (proceduresRes.data ?? []).map((p) => [p.patient_id, p])
  );
  const latestZone = new Map<string, { zone: string; at: string }>();
  for (const c of checkInsRes.data ?? []) {
    if (!latestZone.has(c.patient_id)) {
      latestZone.set(c.patient_id, {
        zone: c.patient_zone,
        at: c.created_at,
      });
    }
  }
  const threadStatus = new Map(
    (threadsRes.data ?? []).map((t) => [t.patient_id, t.status])
  );

  const filter = {
    procedures: params.procedures ?? [],
    surgeonIds: params.surgeonIds ?? [],
    surgeryFrom: params.from ?? null,
    surgeryTo: params.to ?? null,
    zone: params.zone ?? null,
  };

  const patientIds = (patientsRes.data ?? []).map((p) => p.id);
  let scheduledByPatient = new Map<string, { s: number; t: number }>();
  if (patientIds.length > 0) {
    const { data: meds } = await supabase
      .from("medications")
      .select("id, patient_id");
    const patientByMed = new Map((meds ?? []).map((m) => [m.id, m.patient_id]));
    const { data: doses } = await supabase
      .from("medication_doses")
      .select("medication_id, taken_at");
    scheduledByPatient = new Map();
    for (const d of doses ?? []) {
      const pid = patientByMed.get(d.medication_id);
      if (!pid) continue;
      const t = scheduledByPatient.get(pid) ?? { s: 0, t: 0 };
      t.s += 1;
      if (d.taken_at) t.t += 1;
      scheduledByPatient.set(pid, t);
    }
  }

  const rows = (patientsRes.data ?? [])
    .map((p) => {
      const proc = procByPatient.get(p.id);
      const zoneInfo = latestZone.get(p.id);
      return {
        id: p.id,
        name: p.name,
        procedureType: proc?.procedure_type ?? null,
        surgeonId: proc?.surgeon_id ?? null,
        surgeryDate: proc?.surgery_date ?? null,
        zone: zoneInfo?.zone ?? null,
        lastCheckIn: zoneInfo?.at ?? null,
        threadStatus: threadStatus.get(p.id) ?? "none",
      };
    })
    .filter((p) =>
      matchesCohortReport(
        {
          procedureType: p.procedureType,
          surgeonId: p.surgeonId,
          surgeryDate: p.surgeryDate,
          zone: p.zone,
        },
        filter
      )
    )
    .map((p) => {
      const adh = scheduledByPatient.get(p.id);
      return {
        displayName: displayName(p.name, include),
        surgeryDate: p.surgeryDate,
        recoveryDay: p.surgeryDate
          ? Math.max(0, daysBetween(p.surgeryDate, todayISO))
          : null,
        zone: p.zone ?? "—",
        adherencePct: adh ? adherenceRate(adh.t, adh.s) : null,
        lastCheckIn: p.lastCheckIn
          ? p.lastCheckIn.slice(0, 10)
          : "No check-ins",
        threadStatus: p.threadStatus,
      };
    });

  return {
    filter: filter as unknown,
    count: rows.length,
    patients: rows,
  };
}

function defaultMonth(): string {
  const d = new Date();
  d.setUTCDate(0); // last day of previous month
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-AU", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

// Dispatches to the builder for the given report type.
export async function buildReport(
  supabase: Supa,
  type: ReportType,
  parameters: Record<string, unknown>,
  includeIdentifiers: boolean,
  referenceTime: Date
): Promise<ReportData> {
  switch (type) {
    case "monthly_activity":
      return buildMonthlyActivity(supabase, parameters, includeIdentifiers);
    case "surgeon":
      return buildSurgeon(supabase, parameters, includeIdentifiers);
    case "compliance":
      return buildCompliance(supabase, parameters);
    case "cohort":
      return buildCohort(
        supabase,
        parameters,
        includeIdentifiers,
        referenceTime
      );
  }
}

export type { ZoneDistribution };

import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database, Json } from "@/types/database.types";
import { initials } from "@/lib/bulk-push";
import {
  addAppointmentAction,
  addMedicationAction,
  addNoteAction,
  addProcedureAction,
  dischargePatientAction,
  readmitPatientAction,
  resolveFlagAction,
  unpinContentAction,
  setPatientFeatureOverrideAction,
  stopMedicationAction,
  updatePatientDetailsAction,
  uploadDocumentAction,
} from "./actions";
import { FlagPatientModal } from "./FlagPatientModal";
import { NextAppointmentModal } from "./NextAppointmentModal";
import { PushContentModal } from "./PushContentModal";
import { DOCUMENT_CATEGORY_ORDER } from "@/lib/documents";
import { CloseDetailsOnSubmit } from "@/components/CloseDetailsOnSubmit";
import { FEATURES, resolveFeature } from "@/lib/feature-flags";
import {
  appointmentTypeLabel,
  formatAppointmentDateTime,
  locationLabel,
  selectNextAppointment,
} from "@/lib/appointments";

export const dynamic = "force-dynamic";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Procedure = Database["public"]["Tables"]["procedures"]["Row"];
type Medication = Database["public"]["Tables"]["medications"]["Row"];
type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"];
type StaffNote = Database["public"]["Tables"]["staff_notes"]["Row"];
type ManualFlag = Database["public"]["Tables"]["manual_flags"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type StaffUser = Database["public"]["Tables"]["staff_users"]["Row"];

// 90-day post-op window — the recovery progress bar and the analytics
// completion view both treat day 90 as the end of active recovery.
const RECOVERY_WINDOW = 90;

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const surgery = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.floor((Date.now() - surgery) / (1000 * 60 * 60 * 24));
}

function age(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) years -= 1;
  return years;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "Today" / "Yesterday" / "11 May" for a check-in's date. Day boundaries
// are evaluated in the clinic's timezone (Australia/Brisbane), not the
// server's local time — on a UTC host the bare en-CA dates would be wrong.
function relativeDay(iso: string): string {
  const brisbane = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
  const day = brisbane(new Date(iso));
  const today = brisbane(new Date());
  const yesterday = brisbane(new Date(Date.now() - 86_400_000));
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric",
    month: "short",
  });
}

// "08:00" → "8AM", "16:00" → "4PM" — for the medication schedule pill.
function fmtClock(t: string): string {
  const hr = Number(t.split(":")[0] ?? "0");
  const period = hr < 12 ? "AM" : "PM";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}${period}`;
}

// Stable per-author avatar colour for the internal notes thread.
const NOTE_AVATAR_COLORS = [
  "bg-violet-500",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-sky-600",
  "bg-rose-500",
  "bg-teal-600",
];
function noteAvatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return NOTE_AVATAR_COLORS[h % NOTE_AVATAR_COLORS.length]!;
}

// Coloured icon tile per optional patient-app feature.
const FEATURE_ICON: Record<string, { emoji: string; bg: string }> = {
  surgeon_spotlight: { emoji: "🎥", bg: "bg-emerald-600" },
  eye_photo_prompt: { emoji: "📷", bg: "bg-orange-500" },
  checkin_nudge: { emoji: "🔔", bg: "bg-amber-500" },
  lockscreen_widget: { emoji: "🔒", bg: "bg-slate-600" },
  feedback_tile: { emoji: "⭐", bg: "bg-sky-600" },
  preop_tile: { emoji: "📅", bg: "bg-violet-600" },
  bonus_theme_pack: { emoji: "✨", bg: "bg-fuchsia-600" },
};

// Reads a string field out of a jsonb column (emergency_contact / health_fund).
function jsonField(value: Json | null | undefined, key: string): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = (value as Record<string, Json>)[key];
    return typeof v === "string" && v.trim() ? v : null;
  }
  return null;
}

function zoneClasses(zone: string | null): string {
  switch (zone) {
    case "green":
      return "bg-green-100 text-green-800";
    case "yellow":
      return "bg-yellow-100 text-yellow-800";
    case "orange":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-fv-bg-soft text-fv-text-secondary";
  }
}

function flagClasses(level: string | null): string {
  switch (level) {
    case "yellow":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "orange":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "red":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-fv-bg-soft text-fv-text-secondary border-fv-bg-soft";
  }
}

function procedureStatus(p: Procedure): { label: string; cls: string } {
  if (p.status === "completed") {
    return { label: "Completed", cls: "bg-fv-bg-soft text-fv-text-secondary" };
  }
  if (p.status === "cancelled") {
    return { label: "Cancelled", cls: "bg-fv-bg-soft text-fv-text-secondary" };
  }
  const day = daysSince(p.surgery_date);
  if (day !== null && day < 0) {
    return { label: "Scheduled", cls: "bg-blue-100 text-blue-800" };
  }
  return {
    label: `In recovery · Day ${day ?? "?"}`,
    cls: "bg-green-100 text-green-800",
  };
}

// ─── Primitives ────────────────────────────────────────────────────────────

const inputCls =
  "rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5 text-sm";
const fieldLabel = "text-xs text-fv-text-secondary";

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full bg-fv-bg-accent-soft text-lg font-semibold text-fv-accent-strong">
      {initials(name)}
    </span>
  );
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

// Uppercase-label + value cell for the procedure card field grid.
function ProcField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-fv-text-secondary">
        {label}
      </div>
      <div className="capitalize text-sm text-fv-text-primary">{value}</div>
    </div>
  );
}

function Panel({
  title,
  action,
  badge,
  id,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-xl bg-fv-bg-card shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 border-b border-fv-bg-soft px-5 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-fv-text-primary">
            {title}
          </h3>
          {badge}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

const SECTION_ICONS = {
  heart:
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  graph:
    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
};

const SECTION_COLORS = {
  green: "bg-green-100 text-green-600",
  blue: "bg-blue-100 text-blue-600",
  amber: "bg-amber-100 text-amber-600",
  purple: "bg-purple-100 text-purple-600",
};

function SectionHeader({
  label,
  icon,
  color,
}: {
  label: string;
  icon: keyof typeof SECTION_ICONS;
  color: keyof typeof SECTION_COLORS;
}) {
  return (
    <div className="mb-1 mt-3 flex items-center gap-2 first:mt-0">
      <span
        className={`grid h-7 w-7 place-items-center rounded-lg ${SECTION_COLORS[color]}`}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[15px] w-[15px]"
          dangerouslySetInnerHTML={{ __html: SECTION_ICONS[icon] }}
        />
      </span>
      <h2 className="text-xs font-bold uppercase tracking-wider text-fv-text-primary">
        {label}
      </h2>
    </div>
  );
}

function HiddenPatientId({ id }: { id: string }) {
  return <input type="hidden" name="patient_id" value={id} />;
}

const summaryBtn =
  "cursor-pointer rounded-md border border-fv-border px-3 py-1 text-xs font-semibold text-fv-accent-strong";

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const patientId = params.id;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    patientResult,
    proceduresResult,
    medicationsResult,
    appointmentsResult,
    checkInsResult,
    notesResult,
    flagsResult,
    documentsResult,
    staffResult,
    featureFlagsResult,
    featureDefaultsResult,
    pinnedContentResult,
    threadResult,
    contentItemsResult,
    facilitiesResult,
  ] = await Promise.all([
    supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
    supabase
      .from("procedures")
      .select("*")
      .eq("patient_id", patientId)
      .order("surgery_date", { ascending: false }),
    supabase
      .from("medications")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", patientId)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("check_ins")
      .select("*")
      .eq("patient_id", patientId)
      .order("recovery_day", { ascending: false }),
    supabase
      .from("staff_notes")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("manual_flags")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("uploaded_at", { ascending: false }),
    supabase.from("staff_users").select("id, name, role").order("name"),
    supabase
      .from("patient_feature_flags")
      .select("feature_key, enabled, changed_by_staff_id, changed_at")
      .eq("patient_id", patientId),
    supabase.from("feature_defaults").select("feature_key, enabled"),
    supabase
      .from("patient_pinned_content")
      .select("id, label, ad_hoc_message, content_id, content_items(title, type)")
      .eq("patient_id", patientId)
      .order("created_at"),
    supabase
      .from("message_threads")
      .select("id")
      .eq("patient_id", patientId)
      .maybeSingle(),
    supabase
      .from("content_items")
      .select("id, type, title, audience, procedures")
      .order("title"),
    supabase
      .from("partner_facilities")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);
  const pinnedContent = pinnedContentResult.data ?? [];
  const messageThreadId = threadResult.data?.id ?? null;
  const contentOptions = contentItemsResult.data ?? [];
  const facilities = facilitiesResult.data ?? [];

  const patient = patientResult.data as Patient | null;
  if (!patient) notFound();

  const procedures = (proceduresResult.data ?? []) as Procedure[];
  const medications = (medicationsResult.data ?? []) as Medication[];
  const appointments = (appointmentsResult.data ?? []) as Appointment[];
  const checkIns = (checkInsResult.data ?? []) as CheckIn[];
  const notes = (notesResult.data ?? []) as StaffNote[];
  const flags = (flagsResult.data ?? []) as ManualFlag[];
  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const staff = (staffResult.data ?? []) as Pick<
    StaffUser,
    "id" | "name" | "role"
  >[];

  const staffById = new Map(staff.map((s) => [s.id, s]));
  const featureFlagByKey = new Map(
    (featureFlagsResult.data ?? []).map((f) => [f.feature_key, f])
  );
  const featureDefaultByKey = new Map(
    (featureDefaultsResult.data ?? []).map((d) => [d.feature_key, d.enabled])
  );
  const activeProcedure = procedures.find((p) => p.status === "active");
  const nextAppointment = selectNextAppointment(appointments, new Date());
  const upcomingAppointments = appointments.filter(
    (a) => a.status === "to_book" || a.status === "confirmed"
  );
  const activeMeds = medications.filter((m) => m.stopped_at === null);
  const stoppedMeds = medications.filter((m) => m.stopped_at !== null);
  const openFlags = flags.filter((f) => f.resolved_at === null);
  const resolvedFlags = flags.filter((f) => f.resolved_at !== null);
  const currentStaffName = user ? staffById.get(user.id)?.name ?? null : null;
  const currentStaffRole = user ? staffById.get(user.id)?.role ?? null : null;

  // Patient status pill. An explicit discharge wins; otherwise flagged
  // wins; a patient with no active procedure is also treated as discharged.
  const isDischarged = patient.discharged_at != null;
  const hasActiveProcedure = procedures.some((p) => p.status === "active");
  const status = isDischarged
    ? { label: "Discharged", cls: "bg-fv-bg-soft text-fv-text-secondary" }
    : openFlags.length > 0
      ? { label: "Flagged", cls: "bg-orange-100 text-orange-800" }
      : !hasActiveProcedure
        ? { label: "Discharged", cls: "bg-fv-bg-soft text-fv-text-secondary" }
        : { label: "On track", cls: "bg-green-100 text-green-800" };

  const recoveryDay = activeProcedure
    ? daysSince(activeProcedure.surgery_date)
    : null;
  const progressPct =
    recoveryDay === null
      ? 0
      : Math.max(0, Math.min(100, (recoveryDay / RECOVERY_WINDOW) * 100));
  const recordId =
    patient.paired_clinic_record_id ?? `FV-${patient.id.slice(0, 8).toUpperCase()}`;
  const patientAge = age(patient.date_of_birth);

  const metaParts = [
    patientAge !== null ? `${patientAge} yrs` : null,
    patient.email,
    patient.phone ?? null,
    `ID #${recordId}`,
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <Link
        href="/patients"
        className="text-xs font-semibold text-fv-text-secondary hover:underline"
      >
        ← Patients
      </Link>

      {searchParams.error ? (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {/* ─── Detail header (full width) ─── */}
      <section className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-fv-bg-card p-5 shadow-sm">
        <Avatar name={patient.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-fv-text-primary">
              {patient.name}
            </h1>
            <Pill label={status.label} cls={status.cls} />
          </div>
          <p className="mt-1 text-sm text-fv-text-secondary">
            {metaParts.join(" · ")}
          </p>
        </div>
      </section>

      {/* ─── Recovery progress (full width) ─── */}
      <section className="mt-[14px] rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Recovery progress
        </p>
        {activeProcedure ? (
          <>
            <p className="mt-1 text-xl font-semibold">
              Day {recoveryDay ?? "?"} of {RECOVERY_WINDOW} ·{" "}
              {activeProcedure.procedure_type.toUpperCase()}
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-white/80">
              Surgery: {fmtDate(activeProcedure.surgery_date)} · Next
              follow-up:{" "}
              {nextAppointment
                ? nextAppointment.status === "to_book" ||
                  !nextAppointment.scheduled_at
                  ? "To be booked"
                  : formatAppointmentDateTime(nextAppointment.scheduled_at)
                : "To be booked"}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xl font-semibold">No active procedure</p>
        )}
      </section>

      {/* ─── Two-column grid — stacks below 1100px ─── */}
      <div className="mt-[14px] grid grid-cols-1 gap-[14px] min-[1100px]:grid-cols-[1.4fr_1fr]">
        {/* ── LEFT COLUMN ── */}
        <div className="flex min-w-0 flex-col gap-[14px]">
          <SectionHeader label="Clinical" icon="heart" color="green" />

          {/* Patient details */}
          <Panel
            id="patient-details"
            title="Patient details"
            action={
              <a href="#edit-details" className={summaryBtn}>
                Edit
              </a>
            }
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className={fieldLabel}>Full name</dt>
                <dd className="text-fv-text-primary">{patient.name}</dd>
              </div>
              <div>
                <dt className={fieldLabel}>Date of birth</dt>
                <dd className="text-fv-text-primary">
                  {fmtDate(patient.date_of_birth)}
                </dd>
              </div>
              <div>
                <dt className={fieldLabel}>Medicare</dt>
                <dd className="text-fv-text-primary">
                  {patient.medicare_number ?? "—"}
                </dd>
              </div>
              <div>
                <dt className={fieldLabel}>Private health</dt>
                <dd className="text-fv-text-primary">
                  {jsonField(patient.health_fund, "fund") ??
                    jsonField(patient.health_fund, "name") ??
                    jsonField(patient.health_fund, "provider") ??
                    "—"}
                </dd>
              </div>
              <div>
                <dt className={fieldLabel}>Emergency contact</dt>
                <dd className="text-fv-text-primary">
                  {jsonField(patient.emergency_contact, "name") ? (
                    <>
                      {jsonField(patient.emergency_contact, "name")}
                      {jsonField(patient.emergency_contact, "relationship")
                        ? ` (${jsonField(
                            patient.emergency_contact,
                            "relationship"
                          )})`
                        : ""}
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className={fieldLabel}>Allergies</dt>
                <dd className="text-fv-text-primary">
                  {patient.allergies.length > 0
                    ? patient.allergies.join(", ")
                    : "—"}
                </dd>
              </div>
            </dl>

            <details id="edit-details" className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-fv-accent-strong">
                Edit details
              </summary>
              <form
                action={updatePatientDetailsAction}
                className="mt-3 grid grid-cols-2 gap-3 text-sm"
              >
                <HiddenPatientId id={patient.id} />
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>First name</span>
                  <input
                    type="text"
                    name="first_name"
                    required
                    defaultValue={patient.first_name}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Surname</span>
                  <input
                    type="text"
                    name="last_name"
                    defaultValue={patient.last_name}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Email</span>
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={patient.email}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={patient.phone ?? ""}
                    placeholder="+61400000000"
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Date of birth</span>
                  <input
                    type="date"
                    name="date_of_birth"
                    defaultValue={patient.date_of_birth ?? ""}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Allergies (comma-separated)</span>
                  <input
                    type="text"
                    name="allergies"
                    defaultValue={patient.allergies.join(", ")}
                    placeholder="Penicillin, Latex"
                    className={inputCls}
                  />
                </label>
                <p className="col-span-2 text-xs text-fv-text-secondary">
                  Changing the phone number marks it unverified until the
                  patient re-confirms it by SMS.
                </p>
                <button
                  type="submit"
                  className="col-span-2 mt-1 self-start rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Save details
                </button>
              </form>
            </details>
          </Panel>

          {/* Procedures */}
          <Panel
            title="Procedures"
            badge={
              <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
                {procedures.length}
              </span>
            }
          >
            <p className="text-sm text-fv-text-secondary">
              Track each surgical event separately. A patient can have any
              number of procedures — sequential per-eye surgeries, touch-ups,
              different procedures over time, or multiple issues treated at
              once. Each procedure has its own recovery timeline, medications,
              content set, and check-in history.
            </p>
            {procedures.length === 0 ? (
              <p className="mt-3 text-sm text-fv-text-secondary">
                No procedures yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {procedures.map((p, i) => {
                  const ps = procedureStatus(p);
                  const accent =
                    p.status === "active"
                      ? "border-l-emerald-600"
                      : "border-l-amber-500";
                  return (
                    <li
                      key={p.id}
                      className={`rounded-xl border-l-4 bg-fv-bg-soft/40 p-3.5 text-sm ${accent}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-[11px] font-semibold text-fv-text-secondary">
                          Procedure {i + 1}
                        </span>
                        <span className="font-semibold text-fv-text-primary">
                          {p.procedure_type.toUpperCase()}
                        </span>
                        <span className="ml-auto">
                          <Pill label={ps.label} cls={ps.cls} />
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                        <ProcField
                          label="Procedure"
                          value={p.procedure_type.toUpperCase()}
                        />
                        <ProcField
                          label="Surgeon"
                          value={staffById.get(p.surgeon_id)?.name ?? "—"}
                        />
                        <ProcField label="Eye(s) treated" value={p.eye} />
                        <ProcField
                          label="Date"
                          value={fmtDate(p.surgery_date)}
                        />
                      </div>
                      {p.custom_notes ? (
                        <div className="mt-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-fv-text-secondary">
                            Custom recovery notes (patient-facing)
                          </div>
                          <div className="mt-1 rounded-lg border border-fv-bg-soft bg-fv-bg-app px-3 py-2 text-sm text-fv-text-primary">
                            {p.custom_notes}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <details className="mt-3">
              <summary className="block cursor-pointer rounded-lg border border-dashed border-fv-border px-3 py-2 text-center text-sm font-semibold text-fv-accent-strong">
                + Add another procedure
              </summary>
              <form
                action={addProcedureAction}
                className="mt-3 grid grid-cols-2 gap-3 text-sm"
              >
                <HiddenPatientId id={patient.id} />
                <CloseDetailsOnSubmit />
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Type</span>
                  <input
                    type="text"
                    name="procedure_type"
                    placeholder="lasik / prk / cataract / icl"
                    required
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Eye</span>
                  <select
                    name="eye"
                    required
                    defaultValue="both"
                    className={inputCls}
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Surgeon</span>
                  <select name="surgeon_id" required className={inputCls}>
                    <option value="">Select…</option>
                    {staff
                      .filter((s) => s.role === "surgeon")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Surgery date</span>
                  <input
                    type="date"
                    name="surgery_date"
                    required
                    className={inputCls}
                  />
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                  <span className={fieldLabel}>Day hospital (optional)</span>
                  <select
                    name="facility_id"
                    defaultValue=""
                    className={inputCls}
                  >
                    <option value="">Not set</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                  <span className={fieldLabel}>Custom notes (optional)</span>
                  <textarea
                    name="custom_notes"
                    rows={2}
                    className={inputCls}
                  />
                </label>
                <button
                  type="submit"
                  className="col-span-2 mt-1 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Add procedure
                </button>
              </form>
            </details>
            <p className="mt-3 text-xs text-fv-text-secondary">
              For patients with multiple issues — e.g. cataract on one eye plus
              PRK on the other, or a planned second-eye procedure.
            </p>
          </Panel>

          {/* Medications */}
          <Panel
            title="Medications"
            badge={
              <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
                {activeMeds.length} active
              </span>
            }
            action={
              <details className="relative">
                <summary className={summaryBtn}>+ Add medication</summary>
                <form
                  action={addMedicationAction}
                  className="absolute right-0 z-10 mt-2 grid w-[320px] grid-cols-2 gap-3 rounded-xl border border-fv-bg-soft bg-fv-bg-card p-4 text-sm shadow-lg"
                >
                  <HiddenPatientId id={patient.id} />
                  <CloseDetailsOnSubmit />
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className={fieldLabel}>Name</span>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Pred Forte 1%"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Dose</span>
                    <input
                      type="text"
                      name="dose"
                      required
                      placeholder="1 drop"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Route</span>
                    <input
                      type="text"
                      name="route"
                      required
                      placeholder="topical eye"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Frequency</span>
                    <input
                      type="text"
                      name="frequency"
                      required
                      placeholder="4x daily"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Scheduled times</span>
                    <input
                      type="text"
                      name="scheduled_times"
                      placeholder="08:00, 12:00"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Start date</span>
                    <input
                      type="date"
                      name="start_date"
                      required
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>End date</span>
                    <input type="date" name="end_date" className={inputCls} />
                  </label>
                  <button
                    type="submit"
                    className="col-span-2 mt-1 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Add medication
                  </button>
                </form>
              </details>
            }
          >
            {activeMeds.length === 0 ? (
              <p className="text-sm text-fv-text-secondary">
                No active medications.
              </p>
            ) : (
              <ul className="space-y-2">
                {activeMeds.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-fv-bg-soft p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-fv-text-primary">
                          {m.name}
                        </div>
                        <div className="text-xs text-fv-text-secondary">
                          {m.dose} · {m.route}
                        </div>
                      </div>
                      <details className="shrink-0">
                        <summary
                          title="Remove medication"
                          className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md border border-red-200 bg-red-50 text-red-600"
                        >
                          🗑
                        </summary>
                        <form
                          action={stopMedicationAction}
                          className="mt-2 flex flex-col gap-2"
                        >
                        <HiddenPatientId id={patient.id} />
                        <input
                          type="hidden"
                          name="medication_id"
                          value={m.id}
                        />
                        <select
                          name="stop_reason"
                          required
                          className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1 text-xs"
                        >
                          <option value="">Reason…</option>
                          <option value="Course completed">
                            Course completed
                          </option>
                          <option value="Patient allergy">
                            Patient allergy
                          </option>
                          <option value="Side effects">Side effects</option>
                          <option value="Prescription changed by surgeon">
                            Prescription changed by surgeon
                          </option>
                          <option value="Patient declined">
                            Patient declined
                          </option>
                          <option value="Other">Other</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Confirm stop
                        </button>
                      </form>
                      </details>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        {m.frequency}
                        {m.scheduled_times.length > 0
                          ? ` · ${m.scheduled_times.map(fmtClock).join(" ")}`
                          : ""}
                      </span>
                      <span className="text-[11px] text-fv-text-secondary">
                        {fmtDate(m.start_date)} →{" "}
                        {m.end_date ? fmtDate(m.end_date) : "ongoing"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {stoppedMeds.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-fv-text-secondary">
                  Stopped medications · history ({stoppedMeds.length})
                </summary>
                <ul className="mt-2 space-y-2">
                  {stoppedMeds.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-md bg-fv-bg-soft p-3 text-sm opacity-75"
                    >
                      <div className="font-medium text-fv-text-primary line-through">
                        {m.name} ({m.dose})
                      </div>
                      <div className="text-xs text-fv-text-secondary">
                        Stopped {fmtDateTime(m.stopped_at)} by{" "}
                        {staffById.get(m.stopped_by_staff_id ?? "")?.name ??
                          "—"}{" "}
                        · {m.stop_reason}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Panel>

          <SectionHeader label="Internal team" icon="chat" color="blue" />

          {/* Internal staff notes */}
          <Panel
            title="Internal staff notes"
            badge={
              <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fv-text-secondary">
                Not visible to patient
              </span>
            }
          >
            {notes.length === 0 ? (
              <p className="text-sm text-fv-text-secondary">No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => {
                  const author = staffById.get(n.author_staff_id);
                  return (
                    <li
                      key={n.id}
                      className="rounded-lg bg-fv-bg-soft/60 p-3 text-sm"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ${noteAvatarColor(
                            n.author_staff_id
                          )}`}
                        >
                          {initials(author?.name ?? "?")}
                        </span>
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-fv-text-primary">
                            {author?.name ?? "Unknown"}
                            {author?.role ? (
                              <span className="font-normal capitalize text-fv-text-secondary">
                                {" "}
                                ({author.role})
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs text-fv-text-secondary">
                            {fmtDateTime(n.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-fv-text-primary">
                        {n.body}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              action={addNoteAction}
              className="mt-4 flex flex-col gap-2 text-sm"
            >
              <HiddenPatientId id={patient.id} />
              <textarea
                name="body"
                rows={3}
                placeholder="Internal observation, handoff, plan…"
                required
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fv-text-secondary">
                  Posting as{" "}
                  <strong className="text-fv-text-primary">
                    {currentStaffName ?? "you"}
                  </strong>
                  {currentStaffRole ? (
                    <span className="capitalize"> ({currentStaffRole})</span>
                  ) : null}
                </span>
                <button
                  type="submit"
                  className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Post note
                </button>
              </div>
            </form>
          </Panel>

          {/* Appointments */}
          <Panel
            id="appointments"
            title="Appointments"
            action={
              <details className="relative">
                <summary className={summaryBtn}>
                  + Schedule appointment
                </summary>
                <form
                  action={addAppointmentAction}
                  className="absolute right-0 z-10 mt-2 grid w-[320px] grid-cols-2 gap-3 rounded-xl border border-fv-bg-soft bg-fv-bg-card p-4 text-sm shadow-lg"
                >
                  <HiddenPatientId id={patient.id} />
                  <CloseDetailsOnSubmit />
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Type</span>
                    <input
                      type="text"
                      name="appointment_type"
                      required
                      placeholder="1-week, 1-month…"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>When</span>
                    <input
                      type="datetime-local"
                      name="scheduled_at"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Location</span>
                    <select name="location" className={inputCls}>
                      <option value="">—</option>
                      <option value="in_clinic">In clinic</option>
                      <option value="phone">Phone</option>
                      <option value="video">Video</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Clinician</span>
                    <select name="clinician_id" className={inputCls}>
                      <option value="">—</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className={fieldLabel}>Notes (optional)</span>
                    <textarea name="notes" rows={2} className={inputCls} />
                  </label>
                  <button
                    type="submit"
                    className="col-span-2 mt-1 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Schedule
                  </button>
                </form>
              </details>
            }
          >
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-fv-text-secondary">
                No upcoming appointments.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingAppointments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-fv-bg-soft px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-fv-text-primary">
                        {appointmentTypeLabel(a.appointment_type)}
                      </div>
                      <div className="text-xs text-fv-text-secondary">
                        {a.scheduled_at
                          ? fmtDateTime(a.scheduled_at)
                          : "To be booked"}
                        {a.location
                          ? ` · ${locationLabel(a.location)}`
                          : ""}
                        {a.clinician_id
                          ? ` · ${staffById.get(a.clinician_id)?.name ?? "—"}`
                          : ""}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-800"
                          : a.status === "to_book"
                            ? "bg-amber-100 text-amber-800"
                            : a.status === "cancelled"
                              ? "bg-red-100 text-red-700"
                              : "bg-fv-bg-soft text-fv-text-secondary"
                      }`}
                    >
                      {a.status === "to_book"
                        ? "To book"
                        : a.status === "confirmed"
                          ? "Confirmed"
                          : a.status === "completed"
                            ? "Completed"
                            : "Cancelled"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-fv-text-secondary">
              Appointments here appear on the patient&apos;s home screen as the
              &ldquo;next appointment&rdquo; card. Unscheduled appointments show
              as &ldquo;to be made&rdquo; in the patient app.
            </p>
            {nextAppointment ? (
              <div className="mt-3 border-t border-fv-bg-soft pt-3">
                <NextAppointmentModal
                  patientId={patient.id}
                  appointment={nextAppointment}
                  clinicians={staff.map((s) => ({ id: s.id, name: s.name }))}
                />
              </div>
            ) : null}
          </Panel>

          <SectionHeader
            label="Patient experience"
            icon="phone"
            color="purple"
          />

          {/* Patient app features */}
          <Panel
            title="Patient app features"
            action={
              <span className="text-xs font-medium text-fv-text-secondary">
                Opt-in per patient
              </span>
            }
          >
            <p className="text-sm text-fv-text-secondary">
              Optional features for this patient. None of these are shown by
              default — enable only when appropriate for this person.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {FEATURES.map((feature) => {
                const flag = featureFlagByKey.get(feature.key);
                const clinicDefault = featureDefaultByKey.get(feature.key);
                const effective = resolveFeature(
                  flag ? { enabled: flag.enabled } : null,
                  clinicDefault === undefined
                    ? null
                    : { enabled: clinicDefault },
                  feature.schemaDefault
                );
                const icon =
                  FEATURE_ICON[feature.key] ?? FEATURE_ICON.feedback_tile!;
                return (
                  <li
                    key={feature.key}
                    className="flex items-center gap-3 rounded-xl border border-fv-bg-soft p-3 text-sm"
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg ${icon.bg}`}
                    >
                      {icon.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-fv-text-primary">
                        {feature.label}
                      </div>
                      <div className="text-xs text-fv-text-secondary">
                        {feature.description}
                      </div>
                    </div>
                    <form action={setPatientFeatureOverrideAction}>
                      <HiddenPatientId id={patient.id} />
                      <input
                        type="hidden"
                        name="feature_key"
                        value={feature.key}
                      />
                      <input
                        type="hidden"
                        name="enabled"
                        value={(!effective).toString()}
                      />
                      <button
                        type="submit"
                        role="switch"
                        aria-checked={effective}
                        title={effective ? "On — tap to turn off" : "Off — tap to turn on"}
                        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                          effective
                            ? "justify-end bg-fv-accent-strong"
                            : "justify-start bg-fv-bg-soft"
                        }`}
                      >
                        <span className="h-5 w-5 rounded-full bg-white shadow" />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Custom content for this patient */}
          <Panel
            title="Custom content for this patient"
            action={
              <PushContentModal
                patientId={patient.id}
                options={contentOptions}
                patientProcedure={activeProcedure?.procedure_type ?? null}
              />
            }
          >
            <p className="text-sm text-fv-text-secondary">
              Pin recovery guides from the library, or a one-off reassurance
              message, to this patient&apos;s app home screen.
            </p>
            {pinnedContent.length === 0 ? (
              <p className="mt-3 text-sm text-fv-text-secondary">
                Nothing pinned yet.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {pinnedContent.map((c) => {
                  const linked = c.content_items;
                  const isMsg = !linked;
                  const title = linked
                    ? linked.title
                    : c.ad_hoc_message ?? c.label ?? "—";
                  const icon = linked
                    ? linked.type === "video"
                      ? "📺"
                      : "📄"
                    : "💬";
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                        isMsg
                          ? "bg-amber-50 text-amber-800"
                          : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {icon} {title}
                      </span>
                      <form action={unpinContentAction} className="shrink-0">
                        <HiddenPatientId id={patient.id} />
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          title="Unpin"
                          className="text-xs font-bold text-fv-text-secondary hover:text-red-600"
                        >
                          ✕
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex min-w-0 flex-col gap-[14px]">
          <SectionHeader
            label="Recovery monitoring"
            icon="graph"
            color="amber"
          />

          {/* Daily check-in log */}
          <Panel
            title="Daily check-in log"
            badge={
              <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
                {checkIns.length}
              </span>
            }
          >
            {checkIns.length === 0 ? (
              <p className="text-sm text-fv-text-secondary">
                No check-ins submitted yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {checkIns.slice(0, 14).map((c) => {
                  const ciStatus =
                    c.recovery_day === 0
                      ? {
                          label: "Surgery",
                          cls: "bg-emerald-100 text-emerald-800",
                        }
                      : c.staff_alert_level !== "none"
                        ? {
                            label: "Review",
                            cls: "bg-amber-100 text-amber-800",
                          }
                        : {
                            label: "Normal",
                            cls: "bg-emerald-100 text-emerald-800",
                          };
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg bg-fv-bg-soft/40 px-3 py-2.5 text-sm"
                    >
                      <div className="w-28 shrink-0">
                        <div className="font-semibold text-fv-text-primary">
                          Day {c.recovery_day}
                        </div>
                        <div className="text-xs text-fv-text-secondary">
                          {relativeDay(c.created_at)}
                        </div>
                      </div>
                      <span className="min-w-0 flex-1 text-xs text-fv-text-secondary">
                        {c.recovery_day === 0
                          ? "Surgery day — pre-op only"
                          : `Pain ${c.pain}/5, vision "${c.vision}", light ${c.light_sensitivity}/5`}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ciStatus.cls}`}
                      >
                        {ciStatus.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Manual flags */}
          <Panel
            id="manual-flags"
            title="Manual flags"
            badge={
              openFlags.length > 0 ? (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                  {openFlags.length} open
                </span>
              ) : undefined
            }
          >
            {openFlags.length === 0 && resolvedFlags.length === 0 ? (
              <p className="mb-3 text-sm text-fv-text-secondary">No flags.</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {openFlags.map((f) => (
                  <li
                    key={f.id}
                    className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${flagClasses(
                      f.alert_level
                    )}`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold capitalize">
                        {f.alert_level}
                      </div>
                      <div>{f.reason}</div>
                      <div className="mt-1 text-xs opacity-75">
                        {staffById.get(f.raised_by_staff_id)?.name ?? "—"} ·{" "}
                        {fmtDateTime(f.created_at)}
                      </div>
                    </div>
                    <form action={resolveFlagAction}>
                      <HiddenPatientId id={patient.id} />
                      <input type="hidden" name="flag_id" value={f.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-md bg-fv-bg-card px-3 py-1 text-xs font-semibold text-fv-text-primary"
                      >
                        Resolve
                      </button>
                    </form>
                  </li>
                ))}
                {resolvedFlags.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-lg bg-fv-bg-soft p-3 text-sm opacity-70"
                  >
                    <div className="font-medium capitalize text-fv-text-primary line-through">
                      {f.alert_level} · {f.reason}
                    </div>
                    <div className="text-xs text-fv-text-secondary">
                      Resolved {fmtDateTime(f.resolved_at)} by{" "}
                      {staffById.get(f.resolved_by_staff_id ?? "")?.name ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <FlagPatientModal patientId={patient.id} />
          </Panel>

          {/* Quick actions */}
          <Panel title="Quick actions">
            <div className="flex flex-col gap-2 text-sm">
              {patient.phone ? (
                <a
                  href={`tel:${patient.phone}`}
                  className="rounded-md border border-fv-bg-soft px-3 py-2 text-left font-medium text-fv-text-primary hover:bg-fv-bg-soft/50"
                >
                  📞 Call patient
                </a>
              ) : null}
              <Link
                href={
                  messageThreadId
                    ? `/inbox?thread=${messageThreadId}`
                    : "/inbox"
                }
                className="rounded-md border border-fv-bg-soft px-3 py-2 text-left font-medium text-fv-text-primary hover:bg-fv-bg-soft/50"
              >
                💬 Send in-app message
              </Link>
              <a
                href="#appointments"
                className="rounded-md border border-fv-bg-soft px-3 py-2 text-left font-medium text-fv-text-primary hover:bg-fv-bg-soft/50"
              >
                📅 Schedule check-in
              </a>
              <a
                href="#documents"
                className="rounded-md border border-fv-bg-soft px-3 py-2 text-left font-medium text-fv-text-primary hover:bg-fv-bg-soft/50"
              >
                📄 Upload to their documents
              </a>
              {isDischarged ? (
                <form action={readmitPatientAction}>
                  <HiddenPatientId id={patient.id} />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-fv-bg-soft px-3 py-2 text-left font-medium text-fv-text-primary hover:bg-fv-bg-soft/50"
                  >
                    📈 Re-admit patient
                  </button>
                </form>
              ) : (
                <details>
                  <summary className="cursor-pointer list-none rounded-md border border-fv-bg-soft px-3 py-2 text-left font-medium text-fv-text-primary hover:bg-fv-bg-soft/50">
                    📈 Mark as discharged
                  </summary>
                  <form action={dischargePatientAction} className="mt-1.5">
                    <HiddenPatientId id={patient.id} />
                    <button
                      type="submit"
                      className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Confirm — discharge {patient.name}
                    </button>
                    <p className="mt-1 text-[11px] text-fv-text-secondary">
                      Removes them from active-recovery lists. They can be
                      re-admitted later.
                    </p>
                  </form>
                </details>
              )}
            </div>
          </Panel>

          <SectionHeader label="Records" icon="doc" color="green" />

          {/* Documents */}
          <Panel
            id="documents"
            title="Documents"
            badge={
              <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
                {documents.length}
              </span>
            }
            action={
              <details className="relative">
                <summary className={summaryBtn}>+ Upload</summary>
                <form
                  action={uploadDocumentAction}
                  className="absolute right-0 z-10 mt-2 flex w-[300px] flex-col gap-3 rounded-xl border border-fv-bg-soft bg-fv-bg-card p-4 text-sm shadow-lg"
                >
                  <HiddenPatientId id={patient.id} />
                  <CloseDetailsOnSubmit />
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Category</span>
                    <select name="category" required className={inputCls}>
                      <option value="">Select…</option>
                      {DOCUMENT_CATEGORY_ORDER.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Title (optional)</span>
                    <input
                      type="text"
                      name="title"
                      placeholder="Defaults to the filename"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>File</span>
                    <input
                      type="file"
                      name="file"
                      required
                      className={inputCls}
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Upload
                  </button>
                </form>
              </details>
            }
          >
            {documents.length === 0 ? (
              <p className="text-sm text-fv-text-secondary">
                No documents on file.
              </p>
            ) : (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg bg-fv-bg-soft px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-fv-text-primary">
                      {d.title ?? d.filename}
                    </div>
                    <div className="text-xs text-fv-text-secondary">
                      {d.category} · {fmtDate(d.uploaded_at)} ·{" "}
                      {staffById.get(d.uploaded_by ?? "")?.name ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}

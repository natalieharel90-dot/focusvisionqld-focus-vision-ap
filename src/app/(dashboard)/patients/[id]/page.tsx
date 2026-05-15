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
  resolveFlagAction,
  setPatientFeatureOverrideAction,
  stopMedicationAction,
  updatePatientDetailsAction,
  uploadDocumentAction,
} from "./actions";
import { FlagPatientModal } from "./FlagPatientModal";
import { NextAppointmentModal } from "./NextAppointmentModal";
import { DOCUMENT_CATEGORY_ORDER } from "@/lib/documents";
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
      className="overflow-hidden rounded-xl bg-fv-bg-card shadow-sm"
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
  ]);

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

  // Patient status pill — derived, no schema field. Flagged wins; otherwise
  // a patient with no active procedure is treated as discharged.
  const hasActiveProcedure = procedures.some((p) => p.status === "active");
  const status =
    openFlags.length > 0
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
        <div className="flex shrink-0 gap-2">
          <Link
            href="/inbox"
            className="rounded-md border border-fv-border px-4 py-2 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft/50"
          >
            Message
          </Link>
          <a
            href="#patient-details"
            className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Edit details
          </a>
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
            {procedures.length === 0 ? (
              <p className="text-sm text-fv-text-secondary">
                No procedures yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {procedures.map((p) => {
                  const ps = procedureStatus(p);
                  return (
                    <li
                      key={p.id}
                      className="rounded-lg border border-fv-bg-soft p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-fv-text-primary">
                          {p.procedure_type.toUpperCase()}
                        </span>
                        <Pill label={ps.label} cls={ps.cls} />
                      </div>
                      <div className="mt-1 text-xs text-fv-text-secondary">
                        {staffById.get(p.surgeon_id)?.name ?? "—"} ·{" "}
                        <span className="capitalize">{p.eye}</span> ·{" "}
                        {fmtDate(p.surgery_date)}
                      </div>
                      {p.custom_notes ? (
                        <p className="mt-2 rounded-md bg-fv-bg-soft px-2 py-1 text-xs text-fv-text-secondary">
                          {p.custom_notes}
                        </p>
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
                <label className="flex flex-col gap-1">
                  <span className={fieldLabel}>Type</span>
                  <input
                    type="text"
                    name="procedure_type"
                    placeholder="lasik / prk / smile / cataract / icl"
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
                    className="flex items-start justify-between gap-3 rounded-lg border border-fv-bg-soft p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-fv-text-primary">
                        {m.name}
                      </div>
                      <div className="text-xs text-fv-text-secondary">
                        {m.dose} · {m.route} · {m.frequency}
                        {m.scheduled_times.length > 0
                          ? ` · ${m.scheduled_times.join(", ")}`
                          : ""}
                      </div>
                      <div className="mt-1 text-xs text-fv-text-secondary">
                        {fmtDate(m.start_date)} →{" "}
                        {m.end_date ? fmtDate(m.end_date) : "ongoing"}
                      </div>
                    </div>
                    <details className="shrink-0">
                      <summary className="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                        Remove
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
                      className="rounded-lg bg-fv-bg-soft p-3 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fv-bg-accent-soft text-[10px] font-semibold text-fv-accent-strong">
                          {initials(author?.name ?? "?")}
                        </span>
                        <div className="min-w-0 text-xs text-fv-text-secondary">
                          <span className="font-semibold text-fv-text-primary">
                            {author?.name ?? "Unknown"}
                          </span>
                          {author?.role ? (
                            <span className="capitalize"> · {author.role}</span>
                          ) : null}
                          {" · "}
                          {fmtDateTime(n.created_at)}
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
                  Posting as {currentStaffName ?? "you"}
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
                <summary className={summaryBtn}>+ Schedule</summary>
                <form
                  action={addAppointmentAction}
                  className="absolute right-0 z-10 mt-2 grid w-[320px] grid-cols-2 gap-3 rounded-xl border border-fv-bg-soft bg-fv-bg-card p-4 text-sm shadow-lg"
                >
                  <HiddenPatientId id={patient.id} />
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
                    <span className="shrink-0 text-xs uppercase tracking-wide text-fv-text-secondary">
                      {a.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
          <Panel title="Patient app features">
            <ul className="space-y-2">
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
                return (
                  <li
                    key={feature.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-fv-bg-soft p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-fv-text-primary">
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
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          effective
                            ? "bg-fv-accent-strong text-white"
                            : "border border-fv-border text-fv-text-secondary"
                        }`}
                      >
                        {effective ? "ON" : "OFF"}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Custom content for this patient */}
          <Panel title="Custom content for this patient">
            <p className="text-sm text-fv-text-secondary">
              No content has been pinned for this patient. Recovery guidance
              follows the clinic defaults for their procedure and surgeon.
            </p>
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
              <ul className="space-y-2">
                {checkIns.slice(0, 14).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-fv-bg-soft px-3 py-2 text-sm"
                  >
                    <span className="w-12 shrink-0 font-semibold tabular-nums text-fv-text-primary">
                      Day {c.recovery_day}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${zoneClasses(
                        c.patient_zone
                      )}`}
                    >
                      {c.patient_zone}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-fv-text-secondary">
                      {c.vision} vision · pain {c.pain}/5 · light{" "}
                      {c.light_sensitivity}/5
                    </span>
                    {c.staff_alert_level !== "none" ? (
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${flagClasses(
                          c.staff_alert_level
                        )}`}
                      >
                        {c.staff_alert_level}
                      </span>
                    ) : null}
                  </li>
                ))}
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
                href="/inbox"
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
                href="#manual-flags"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left font-medium text-amber-800 hover:bg-amber-100"
              >
                🚩 Manually flag for review
              </a>
              <a
                href="#documents"
                className="rounded-md border border-fv-bg-soft px-3 py-2 text-left font-medium text-fv-text-primary hover:bg-fv-bg-soft/50"
              >
                📄 Upload to documents
              </a>
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

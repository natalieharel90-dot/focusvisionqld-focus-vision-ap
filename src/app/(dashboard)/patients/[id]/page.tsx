import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";
import {
  addAppointmentAction,
  addMedicationAction,
  addNoteAction,
  addProcedureAction,
  resolveFlagAction,
  setPatientFeatureOverrideAction,
  stopMedicationAction,
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

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const surgery = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.floor((Date.now() - surgery) / (1000 * 60 * 60 * 24));
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

// ─── Card primitives ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-fv-text-secondary first:mt-0">
      {children}
    </h2>
  );
}

function Card({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 overflow-hidden rounded-xl bg-fv-bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-fv-bg-soft px-5 py-3">
        <h3 className="text-sm font-semibold text-fv-text-primary">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function HiddenPatientId({ id }: { id: string }) {
  return <input type="hidden" name="patient_id" value={id} />;
}

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
  const activeMeds = medications.filter((m) => m.stopped_at === null);
  const stoppedMeds = medications.filter((m) => m.stopped_at !== null);
  const openFlags = flags.filter((f) => f.resolved_at === null);
  const resolvedFlags = flags.filter((f) => f.resolved_at !== null);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Link
            href="/patients"
            className="text-xs font-semibold text-fv-text-secondary hover:underline"
          >
            ← Patients
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-fv-text-primary">
            {patient.name}
          </h1>
          {activeProcedure ? (
            <p className="mt-1 text-sm text-fv-text-secondary">
              Day {daysSince(activeProcedure.surgery_date) ?? "?"} ·{" "}
              {activeProcedure.procedure_type.toUpperCase()} ·{" "}
              {activeProcedure.eye} ·{" "}
              {staffById.get(activeProcedure.surgeon_id)?.name ?? "—"}
            </p>
          ) : (
            <p className="mt-1 text-sm text-fv-text-secondary">
              No active procedure
            </p>
          )}
        </div>
      </div>

      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {/* ─── CLINICAL ─── */}
      <SectionLabel>Clinical</SectionLabel>

      <Card title="Patient details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-fv-text-secondary">Email</dt>
            <dd className="text-fv-text-primary">{patient.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-fv-text-secondary">Phone</dt>
            <dd className="text-fv-text-primary">
              {patient.phone ?? "—"}
              {patient.phone_verified ? "" : " (unverified)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fv-text-secondary">Date of birth</dt>
            <dd className="text-fv-text-primary">
              {fmtDate(patient.date_of_birth)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fv-text-secondary">Allergies</dt>
            <dd className="text-fv-text-primary">
              {patient.allergies.length > 0 ? patient.allergies.join(", ") : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            Procedures
            <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
              {procedures.length}
            </span>
          </span>
        }
      >
        {procedures.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">No procedures yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {procedures.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-md bg-fv-bg-soft px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-fv-text-primary">
                    {p.procedure_type.toUpperCase()} ·{" "}
                    <span className="capitalize">{p.eye}</span>
                  </div>
                  <div className="text-xs text-fv-text-secondary">
                    {fmtDate(p.surgery_date)} ·{" "}
                    {staffById.get(p.surgeon_id)?.name ?? "—"} · {p.status}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-fv-accent-strong">
            + Add procedure
          </summary>
          <form
            action={addProcedureAction}
            className="mt-3 grid grid-cols-2 gap-3 text-sm"
          >
            <HiddenPatientId id={patient.id} />
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Type</span>
              <input
                type="text"
                name="procedure_type"
                placeholder="lasik / prk / smile / cataract / icl"
                required
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Eye</span>
              <select
                name="eye"
                required
                defaultValue="both"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Surgeon</span>
              <select
                name="surgeon_id"
                required
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              >
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
              <span className="text-xs text-fv-text-secondary">
                Surgery date
              </span>
              <input
                type="date"
                name="surgery_date"
                required
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">
                Custom notes (optional)
              </span>
              <textarea
                name="custom_notes"
                rows={2}
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
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
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            Medications
            <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
              {activeMeds.length} active
              {stoppedMeds.length > 0 ? ` · ${stoppedMeds.length} stopped` : ""}
            </span>
          </span>
        }
      >
        {activeMeds.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">
            No active medications.
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {activeMeds.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-fv-bg-soft p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
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
                      {m.taper_notes ? ` · ${m.taper_notes}` : ""}
                    </div>
                  </div>
                  <details className="shrink-0">
                    <summary className="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                      Stop
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
              </li>
            ))}
          </ul>
        )}

        {stoppedMeds.length > 0 ? (
          <details className="mb-4">
            <summary className="cursor-pointer text-xs font-semibold text-fv-text-secondary">
              Show {stoppedMeds.length} stopped
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
                    {staffById.get(m.stopped_by_staff_id ?? "")?.name ?? "—"} ·{" "}
                    {m.stop_reason}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-fv-accent-strong">
            + Add medication
          </summary>
          <form
            action={addMedicationAction}
            className="mt-3 grid grid-cols-2 gap-3 text-sm"
          >
            <HiddenPatientId id={patient.id} />
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Name</span>
              <input
                type="text"
                name="name"
                required
                placeholder="Pred Forte 1%"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Dose</span>
              <input
                type="text"
                name="dose"
                required
                placeholder="1 drop"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Route</span>
              <input
                type="text"
                name="route"
                required
                placeholder="topical eye"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Frequency</span>
              <input
                type="text"
                name="frequency"
                required
                placeholder="4x daily"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">
                Scheduled times
              </span>
              <input
                type="text"
                name="scheduled_times"
                placeholder="08:00, 12:00, 16:00, 20:00"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Start date</span>
              <input
                type="date"
                name="start_date"
                required
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">
                End date (optional)
              </span>
              <input
                type="date"
                name="end_date"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">
                Taper notes (optional)
              </span>
              <textarea
                name="taper_notes"
                rows={2}
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <button
              type="submit"
              className="col-span-2 mt-1 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Add medication
            </button>
          </form>
        </details>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            Appointments
            <span className="rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
              {appointments.length}
            </span>
          </span>
        }
      >
        {appointments.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">No appointments.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {appointments.map((a) => (
              <li
                key={a.id}
                className="rounded-md bg-fv-bg-soft px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-fv-text-primary">
                    {a.appointment_type}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-fv-text-secondary">
                    {a.status}
                  </span>
                </div>
                <div className="text-xs text-fv-text-secondary">
                  {a.scheduled_at ? fmtDateTime(a.scheduled_at) : "To be made"}
                  {a.location ? ` · ${a.location.replace("_", " ")}` : ""}
                  {a.clinician_id
                    ? ` · ${staffById.get(a.clinician_id)?.name ?? "—"}`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-fv-accent-strong">
            + Schedule appointment
          </summary>
          <form
            action={addAppointmentAction}
            className="mt-3 grid grid-cols-2 gap-3 text-sm"
          >
            <HiddenPatientId id={patient.id} />
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Type</span>
              <input
                type="text"
                name="appointment_type"
                required
                placeholder="1-week, 1-month, custom…"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">When</span>
              <input
                type="datetime-local"
                name="scheduled_at"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Location</span>
              <select
                name="location"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              >
                <option value="">—</option>
                <option value="in_clinic">In clinic</option>
                <option value="phone">Phone</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Clinician</span>
              <select
                name="clinician_id"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              >
                <option value="">—</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">
                Notes (optional)
              </span>
              <textarea
                name="notes"
                rows={2}
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <button
              type="submit"
              className="col-span-2 mt-1 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Schedule
            </button>
          </form>
        </details>
      </Card>

      {/* ─── INTERNAL TEAM ─── */}
      <SectionLabel>Internal team</SectionLabel>

      <Card title="Staff notes (internal · append-only)">
        <form
          action={addNoteAction}
          className="mb-4 flex flex-col gap-2 text-sm"
        >
          <HiddenPatientId id={patient.id} />
          <textarea
            name="body"
            rows={3}
            placeholder="Internal observation, handoff, plan…"
            required
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2"
          />
          <button
            type="submit"
            className="self-end rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Post note
          </button>
        </form>

        {notes.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-md bg-fv-bg-soft p-3 text-sm"
              >
                <div className="mb-1 text-xs text-fv-text-secondary">
                  {staffById.get(n.author_staff_id)?.name ?? "Unknown"} ·{" "}
                  {fmtDateTime(n.created_at)}
                </div>
                <div className="whitespace-pre-wrap text-fv-text-primary">
                  {n.body}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            Manual flags
            {openFlags.length > 0 ? (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                {openFlags.length} open
              </span>
            ) : null}
          </span>
        }
      >
        {openFlags.length === 0 && resolvedFlags.length === 0 ? (
          <p className="mb-4 text-sm text-fv-text-secondary">No flags.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {openFlags.map((f) => (
              <li
                key={f.id}
                className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${flagClasses(
                  f.alert_level
                )}`}
              >
                <div>
                  <div className="font-semibold capitalize">
                    {f.alert_level}
                  </div>
                  <div>{f.reason}</div>
                  <div className="mt-1 text-xs opacity-75">
                    Raised by{" "}
                    {staffById.get(f.raised_by_staff_id)?.name ?? "—"} ·{" "}
                    {fmtDateTime(f.created_at)}
                  </div>
                </div>
                <form action={resolveFlagAction}>
                  <HiddenPatientId id={patient.id} />
                  <input type="hidden" name="flag_id" value={f.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-fv-bg-card px-3 py-1 text-xs font-semibold text-fv-text-primary"
                  >
                    Resolve
                  </button>
                </form>
              </li>
            ))}
            {resolvedFlags.map((f) => (
              <li
                key={f.id}
                className="rounded-md bg-fv-bg-soft p-3 text-sm opacity-70"
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

        <div className="mt-2">
          <FlagPatientModal patientId={patient.id} />
        </div>
      </Card>

      <Card title="App features (per-patient)">
        <p className="mb-3 text-xs text-fv-text-secondary">
          Overriding a feature changes it for this patient only. Patients keep
          the state snapshotted at activation unless overridden here.
        </p>
        <ul className="space-y-2">
          {FEATURES.map((feature) => {
            const flag = featureFlagByKey.get(feature.key);
            const clinicDefault = featureDefaultByKey.get(feature.key);
            const effective = resolveFeature(
              flag ? { enabled: flag.enabled } : null,
              clinicDefault === undefined ? null : { enabled: clinicDefault },
              feature.schemaDefault
            );
            const badge = !flag
              ? "Inherits clinic default"
              : flag.changed_by_staff_id
                ? `Set by ${
                    staffById.get(flag.changed_by_staff_id)?.name ?? "staff"
                  } · ${fmtDate(flag.changed_at)}`
                : "Default at activation";
            return (
              <li
                key={feature.key}
                className="flex items-center justify-between rounded-md border border-fv-bg-soft p-3 text-sm"
              >
                <div>
                  <div className="font-medium text-fv-text-primary">
                    {feature.label}
                  </div>
                  <div className="text-xs text-fv-text-secondary">{badge}</div>
                </div>
                <form action={setPatientFeatureOverrideAction}>
                  <HiddenPatientId id={patient.id} />
                  <input type="hidden" name="feature_key" value={feature.key} />
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
      </Card>

      {/* ─── RECOVERY MONITORING ─── */}
      <SectionLabel>Recovery monitoring</SectionLabel>

      <Card title="Next appointment">
        {nextAppointment ? (
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm">
              <div className="font-medium text-fv-text-primary">
                {appointmentTypeLabel(nextAppointment.appointment_type)}
              </div>
              <div className="text-fv-text-secondary">
                {nextAppointment.status === "to_book" ||
                !nextAppointment.scheduled_at
                  ? "Time to be confirmed"
                  : formatAppointmentDateTime(nextAppointment.scheduled_at)}
              </div>
              <div className="text-fv-text-secondary">
                {locationLabel(nextAppointment.location)}
                {nextAppointment.clinician_id
                  ? ` · ${
                      staffById.get(nextAppointment.clinician_id)?.name ?? "—"
                    }`
                  : ""}
              </div>
              {nextAppointment.location_address ? (
                <div className="text-xs text-fv-text-secondary">
                  {nextAppointment.location_address}
                </div>
              ) : null}
              {nextAppointment.calendar_exported_at ? (
                <div className="mt-1 text-xs text-fv-accent-strong">
                  Patient has added this to their calendar.
                </div>
              ) : null}
            </div>
            <NextAppointmentModal
              patientId={patient.id}
              appointment={nextAppointment}
              clinicians={staff.map((s) => ({ id: s.id, name: s.name }))}
            />
          </div>
        ) : (
          <p className="text-sm text-fv-text-secondary">
            No upcoming appointment. Schedule one from the Appointments card
            above.
          </p>
        )}
      </Card>

      <Card title="Daily check-in log">
        {checkIns.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">
            No check-ins submitted yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-fv-bg-soft text-xs uppercase tracking-wide text-fv-text-secondary">
                <tr>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Vision</th>
                  <th className="px-3 py-2">Pain</th>
                  <th className="px-3 py-2">Light</th>
                  <th className="px-3 py-2">Symptoms</th>
                  <th className="px-3 py-2">Zone</th>
                  <th className="px-3 py-2">Alert</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-fv-bg-soft text-fv-text-primary"
                  >
                    <td className="px-3 py-2 tabular-nums">{c.recovery_day}</td>
                    <td className="px-3 py-2 capitalize">{c.vision}</td>
                    <td className="px-3 py-2 tabular-nums">{c.pain}/5</td>
                    <td className="px-3 py-2 tabular-nums">
                      {c.light_sensitivity}/5
                    </td>
                    <td className="px-3 py-2">
                      {c.unusual_symptoms.length > 0
                        ? c.unusual_symptoms.join(", ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${zoneClasses(
                          c.patient_zone
                        )}`}
                      >
                        {c.patient_zone}
                      </span>
                    </td>
                    <td className="px-3 py-2 capitalize">
                      {c.staff_alert_level === "none"
                        ? "—"
                        : c.staff_alert_level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── RECORDS ─── */}
      <SectionLabel>Records</SectionLabel>

      <Card title="Documents">
        {documents.length === 0 ? (
          <p className="mb-4 text-sm text-fv-text-secondary">
            No documents on file.
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-md bg-fv-bg-soft px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-fv-text-primary">
                    {d.title ?? d.filename}
                  </div>
                  <div className="text-xs text-fv-text-secondary">
                    {d.category} · {d.filename} ·{" "}
                    {staffById.get(d.uploaded_by ?? "")?.name ?? "—"} ·{" "}
                    {fmtDateTime(d.uploaded_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-fv-accent-strong">
            + Upload document
          </summary>
          <form
            action={uploadDocumentAction}
            className="mt-3 grid grid-cols-2 gap-3 text-sm"
          >
            <HiddenPatientId id={patient.id} />
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">Category</span>
              <select
                name="category"
                required
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              >
                <option value="">Select…</option>
                {DOCUMENT_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">
                Title (optional)
              </span>
              <input
                type="text"
                name="title"
                placeholder="Defaults to the filename"
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs text-fv-text-secondary">File</span>
              <input
                type="file"
                name="file"
                required
                className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
              />
            </label>
            <button
              type="submit"
              className="col-span-2 mt-1 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Upload
            </button>
          </form>
        </details>
      </Card>
    </main>
  );
}

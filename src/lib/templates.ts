// Procedure template application. A ProcedureTemplate stores default
// medications + appointments for a (surgeon × procedure) combination;
// when a patient is set up, those defaults are materialised as real
// medication / appointment rows, each stamped with source_template_id
// so later analytics can compare a patient's actual regimen to the
// template it started from (template drift).

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export type TemplateMedication = {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  scheduled_times: string[];
  taper_notes?: string | null;
  duration_days?: number | null;
};

export type TemplateAppointment = {
  appointment_type: string;
  days_after_surgery: number;
  location?: "in_clinic" | "phone" | "video" | null;
  notes?: string | null;
};

export type TemplateData = {
  id: string;
  surgeon_id: string;
  procedure_type: string;
  default_medications: TemplateMedication[];
  default_appointments: TemplateAppointment[];
};

type MedicationInsert =
  Database["public"]["Tables"]["medications"]["Insert"];
type AppointmentInsert =
  Database["public"]["Tables"]["appointments"]["Insert"];

// Adds whole days to a YYYY-MM-DD date string, returns YYYY-MM-DD.
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Appointment timestamp: N days after surgery, defaulting to 09:00 in
// Australia/Brisbane (the clinic's timezone).
export function appointmentTimestamp(
  surgeryDate: string,
  daysAfter: number
): string {
  const d = new Date(`${surgeryDate}T09:00:00+10:00`);
  d.setUTCDate(d.getUTCDate() + daysAfter);
  return d.toISOString();
}

// Pure: turns a template + patient + surgery date into the medication
// and appointment rows to insert. No DB access — unit-testable directly.
export function buildTemplateInserts(
  template: TemplateData,
  patientId: string,
  surgeryDate: string
): { medications: MedicationInsert[]; appointments: AppointmentInsert[] } {
  const medications: MedicationInsert[] = template.default_medications.map(
    (m) => ({
      patient_id: patientId,
      name: m.name,
      dose: m.dose,
      route: m.route,
      frequency: m.frequency,
      scheduled_times: m.scheduled_times,
      start_date: surgeryDate,
      end_date:
        m.duration_days && m.duration_days > 0
          ? addDays(surgeryDate, m.duration_days)
          : null,
      taper_notes: m.taper_notes ?? null,
      source_template_id: template.id,
    })
  );

  const appointments: AppointmentInsert[] =
    template.default_appointments.map((a) => ({
      patient_id: patientId,
      appointment_type: a.appointment_type,
      // Defaults are suggestions — reception confirms, so status=to_book.
      scheduled_at: appointmentTimestamp(surgeryDate, a.days_after_surgery),
      location: a.location ?? null,
      notes: a.notes ?? null,
      status: "to_book",
      source_template_id: template.id,
    }));

  return { medications, appointments };
}

// Safely parse the JSONB default_medications / default_appointments
// columns into typed arrays. Unknown/garbage entries are dropped.
export function parseTemplateMedications(raw: unknown): TemplateMedication[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateMedication[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== "string") continue;
    out.push({
      name: o.name,
      dose: typeof o.dose === "string" ? o.dose : "",
      route: typeof o.route === "string" ? o.route : "",
      frequency: typeof o.frequency === "string" ? o.frequency : "",
      scheduled_times: Array.isArray(o.scheduled_times)
        ? o.scheduled_times.filter((t): t is string => typeof t === "string")
        : [],
      taper_notes: typeof o.taper_notes === "string" ? o.taper_notes : null,
      duration_days:
        typeof o.duration_days === "number" ? o.duration_days : null,
    });
  }
  return out;
}

export function parseTemplateAppointments(
  raw: unknown
): TemplateAppointment[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateAppointment[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.appointment_type !== "string") continue;
    const loc = o.location;
    out.push({
      appointment_type: o.appointment_type,
      days_after_surgery:
        typeof o.days_after_surgery === "number" ? o.days_after_surgery : 0,
      location:
        loc === "in_clinic" || loc === "phone" || loc === "video"
          ? loc
          : null,
      notes: typeof o.notes === "string" ? o.notes : null,
    });
  }
  return out;
}

// Orchestrator: loads the template, refuses if archived, and inserts the
// materialised rows. Returns counts for audit logging.
export async function applyTemplateToPatient(
  supabase: SupabaseClient<Database>,
  args: { patientId: string; templateId: string; surgeryDate: string }
): Promise<{ medicationCount: number; appointmentCount: number }> {
  const { data: template, error } = await supabase
    .from("procedure_templates")
    .select(
      "id, surgeon_id, procedure_type, default_medications, default_appointments, archived_at"
    )
    .eq("id", args.templateId)
    .single();
  if (error) throw error;
  if (template.archived_at) {
    throw new Error("Cannot apply an archived template.");
  }

  const data: TemplateData = {
    id: template.id,
    surgeon_id: template.surgeon_id,
    procedure_type: template.procedure_type,
    default_medications: parseTemplateMedications(
      template.default_medications
    ),
    default_appointments: parseTemplateAppointments(
      template.default_appointments
    ),
  };

  const { medications, appointments } = buildTemplateInserts(
    data,
    args.patientId,
    args.surgeryDate
  );

  if (medications.length > 0) {
    const { error: medError } = await supabase
      .from("medications")
      .insert(medications);
    if (medError) throw medError;
  }
  if (appointments.length > 0) {
    const { error: apptError } = await supabase
      .from("appointments")
      .insert(appointments);
    if (apptError) throw apptError;
  }

  return {
    medicationCount: medications.length,
    appointmentCount: appointments.length,
  };
}

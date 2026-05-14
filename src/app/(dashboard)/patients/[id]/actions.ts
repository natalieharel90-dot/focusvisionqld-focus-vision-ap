"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

type ManualFlagLevel = Database["public"]["Enums"]["manual_flag_level"];
type EyeSide = Database["public"]["Enums"]["eye_side"];
type AppointmentLocation =
  Database["public"]["Enums"]["appointment_location"];

const EYE_SIDES: ReadonlyArray<EyeSide> = ["left", "right", "both"];
const FLAG_LEVELS: ReadonlyArray<ManualFlagLevel> = [
  "yellow",
  "orange",
  "red",
];
const APPT_LOCATIONS: ReadonlyArray<AppointmentLocation> = [
  "in_clinic",
  "phone",
  "video",
];

function readPatientId(formData: FormData): string {
  const id = String(formData.get("patient_id") ?? "").trim();
  if (!id) throw new Error("patient_id missing");
  return id;
}

function backWithError(patientId: string, message: string): never {
  redirect(`/patients/${patientId}?error=${encodeURIComponent(message)}`);
}

function parseCsvList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ───── Procedures ─────────────────────────────────────────────────────────

export async function addProcedureAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const procedure_type = String(formData.get("procedure_type") ?? "").trim();
  const eye = String(formData.get("eye") ?? "") as EyeSide;
  const surgeon_id = String(formData.get("surgeon_id") ?? "");
  const surgery_date = String(formData.get("surgery_date") ?? "");
  const custom_notes =
    String(formData.get("custom_notes") ?? "").trim() || null;

  if (!procedure_type) backWithError(patientId, "Procedure type is required.");
  if (!EYE_SIDES.includes(eye)) backWithError(patientId, "Pick an eye.");
  if (!surgeon_id) backWithError(patientId, "Pick a surgeon.");
  if (!surgery_date) backWithError(patientId, "Surgery date is required.");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("procedures")
    .insert({
      patient_id: patientId,
      procedure_type,
      eye,
      surgeon_id,
      surgery_date,
      custom_notes,
      status: "active",
    })
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.procedure_added", {
    patient_id: patientId,
    entity_type: "procedure",
    entity_id: data!.id,
    new_value: data,
  });

  revalidatePath(`/patients/${patientId}`);
}

// ───── Medications ─────────────────────────────────────────────────────────

export async function addMedicationAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const name = String(formData.get("name") ?? "").trim();
  const dose = String(formData.get("dose") ?? "").trim();
  const route = String(formData.get("route") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim();
  const scheduledRaw = String(formData.get("scheduled_times") ?? "");
  const start_date = String(formData.get("start_date") ?? "");
  const end_date = String(formData.get("end_date") ?? "") || null;
  const taper_notes =
    String(formData.get("taper_notes") ?? "").trim() || null;

  if (!name) backWithError(patientId, "Medication name is required.");
  if (!dose) backWithError(patientId, "Dose is required.");
  if (!route) backWithError(patientId, "Route is required.");
  if (!frequency) backWithError(patientId, "Frequency is required.");
  if (!start_date) backWithError(patientId, "Start date is required.");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("medications")
    .insert({
      patient_id: patientId,
      name,
      dose,
      route,
      frequency,
      scheduled_times: parseCsvList(scheduledRaw),
      start_date,
      end_date,
      taper_notes,
    })
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.medication_added", {
    patient_id: patientId,
    entity_type: "medication",
    entity_id: data!.id,
    new_value: data,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function stopMedicationAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const medicationId = String(formData.get("medication_id") ?? "");
  const stop_reason = String(formData.get("stop_reason") ?? "").trim();

  if (!medicationId) backWithError(patientId, "Medication id missing.");
  if (!stop_reason)
    backWithError(patientId, "Stop reason is required (audit log).");

  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Snapshot the before-state for the audit row.
  const { data: before } = await supabase
    .from("medications")
    .select("*")
    .eq("id", medicationId)
    .single();

  const { data: after, error } = await supabase
    .from("medications")
    .update({
      stopped_at: new Date().toISOString(),
      stopped_by_staff_id: user.id,
      stop_reason,
    })
    .eq("id", medicationId)
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.medication_stopped", {
    patient_id: patientId,
    entity_type: "medication",
    entity_id: medicationId,
    old_value: before,
    new_value: after,
  });

  revalidatePath(`/patients/${patientId}`);
}

// ───── Appointments ───────────────────────────────────────────────────────

export async function addAppointmentAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const appointment_type = String(
    formData.get("appointment_type") ?? ""
  ).trim();
  const scheduledRaw = String(formData.get("scheduled_at") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const clinician_id =
    String(formData.get("clinician_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!appointment_type)
    backWithError(patientId, "Appointment type is required.");

  const location =
    locationRaw && APPT_LOCATIONS.includes(locationRaw as AppointmentLocation)
      ? (locationRaw as AppointmentLocation)
      : null;

  const scheduled_at = scheduledRaw ? new Date(scheduledRaw).toISOString() : null;
  const status = scheduled_at ? "confirmed" : "to_book";

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      appointment_type,
      scheduled_at,
      location,
      clinician_id,
      status,
      notes,
    })
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.appointment_scheduled", {
    patient_id: patientId,
    entity_type: "appointment",
    entity_id: data!.id,
    new_value: data,
  });

  revalidatePath(`/patients/${patientId}`);
}

// ───── Staff notes (append-only) ──────────────────────────────────────────

export async function addNoteAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const body = String(formData.get("body") ?? "").trim();

  if (!body) backWithError(patientId, "Note body is required.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await supabase
    .from("staff_notes")
    .insert({
      patient_id: patientId,
      author_staff_id: user.id,
      body,
    })
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.note_added", {
    patient_id: patientId,
    entity_type: "staff_note",
    entity_id: data!.id,
    new_value: { body },
  });

  revalidatePath(`/patients/${patientId}`);
}

// ───── Manual flags ───────────────────────────────────────────────────────

export async function raiseFlagAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const alert_level = String(formData.get("alert_level") ?? "") as ManualFlagLevel;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!FLAG_LEVELS.includes(alert_level))
    backWithError(patientId, "Pick an alert level.");
  if (!reason) backWithError(patientId, "Reason is required.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await supabase
    .from("manual_flags")
    .insert({
      patient_id: patientId,
      raised_by_staff_id: user.id,
      alert_level,
      reason,
    })
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.flag_raised", {
    patient_id: patientId,
    entity_type: "manual_flag",
    entity_id: data!.id,
    new_value: data,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function resolveFlagAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const flagId = String(formData.get("flag_id") ?? "");
  if (!flagId) backWithError(patientId, "Flag id missing.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: before } = await supabase
    .from("manual_flags")
    .select("*")
    .eq("id", flagId)
    .single();

  const { data: after, error } = await supabase
    .from("manual_flags")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by_staff_id: user.id,
    })
    .eq("id", flagId)
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.flag_resolved", {
    patient_id: patientId,
    entity_type: "manual_flag",
    entity_id: flagId,
    old_value: before,
    new_value: after,
  });

  revalidatePath(`/patients/${patientId}`);
}

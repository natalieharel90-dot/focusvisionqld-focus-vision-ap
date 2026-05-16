"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FEATURE_BY_KEY } from "@/lib/feature-flags";
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

// ───── Patient details ────────────────────────────────────────────────────

export async function updatePatientDetailsAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const date_of_birth =
    String(formData.get("date_of_birth") ?? "").trim() || null;
  const allergies = parseCsvList(String(formData.get("allergies") ?? ""));

  if (!first_name) backWithError(patientId, "First name is required.");
  if (!email) backWithError(patientId, "Email is required.");
  if (!email.includes("@")) backWithError(patientId, "Enter a valid email.");

  const supabase = createSupabaseServerClient();

  const { data: before } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();
  if (!before) backWithError(patientId, "Patient not found.");

  // A changed phone number is no longer verified — SMS MFA must re-confirm
  // it before the patient app trusts it again.
  const phoneChanged = (before.phone ?? null) !== phone;
  const phone_verified = phoneChanged ? false : before.phone_verified;

  const { data: after, error } = await supabase
    .from("patients")
    .update({
      first_name,
      last_name,
      email,
      phone,
      phone_verified,
      date_of_birth,
      allergies,
    })
    .eq("id", patientId)
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.details_updated", {
    patient_id: patientId,
    entity_type: "patient",
    entity_id: patientId,
    old_value: before,
    new_value: after,
  });

  revalidatePath(`/patients/${patientId}`);
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
  const facility_id = String(formData.get("facility_id") ?? "").trim() || null;

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
      facility_id,
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

export async function updateAppointmentAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const appointmentId = String(formData.get("appointment_id") ?? "");
  if (!appointmentId) backWithError(patientId, "Missing appointment id.");

  const status = String(formData.get("status") ?? "").trim();
  const scheduledRaw = String(formData.get("scheduled_at") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const clinicianId =
    String(formData.get("clinician_id") ?? "").trim() || null;
  const locationAddress =
    String(formData.get("location_address") ?? "").trim() || null;

  const STATUSES = ["to_book", "confirmed", "completed", "cancelled"];
  if (!STATUSES.includes(status)) backWithError(patientId, "Pick a status.");

  const scheduled_at = scheduledRaw
    ? new Date(scheduledRaw).toISOString()
    : null;
  // The DB CHECK requires a time for any non-to_book status.
  if (status !== "to_book" && !scheduled_at) {
    backWithError(
      patientId,
      "A scheduled time is required unless the status is 'to book'."
    );
  }

  const location =
    locationRaw && APPT_LOCATIONS.includes(locationRaw as AppointmentLocation)
      ? (locationRaw as AppointmentLocation)
      : null;

  const supabase = createSupabaseServerClient();
  const { data: before } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  const { data: after, error } = await supabase
    .from("appointments")
    .update({
      status: status as Database["public"]["Enums"]["appointment_status"],
      scheduled_at,
      location,
      clinician_id: clinicianId,
      location_address: locationAddress,
    })
    .eq("id", appointmentId)
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.appointment_updated", {
    patient_id: patientId,
    entity_type: "appointment",
    entity_id: appointmentId,
    old_value: before,
    new_value: after,
  });

  revalidatePath(`/patients/${patientId}`);
}

// Sends the patient a pre-filled message about an appointment change.
export async function messagePatientAboutAppointmentAction(
  formData: FormData
) {
  const patientId = readPatientId(formData);
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  let { data: thread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (!thread) {
    const { data: created } = await supabase
      .from("message_threads")
      .insert({ patient_id: patientId })
      .select("id")
      .single();
    thread = created ?? null;
  }
  if (!thread) backWithError(patientId, "Could not open the patient's thread.");

  const body =
    "Hi — there's been a change to one of your upcoming appointments. " +
    "Please open the Focus Vision app to see the updated details, and let " +
    "us know if the new time doesn't suit you.";

  const { error } = await supabase.from("messages").insert({
    thread_id: thread!.id,
    sender_type: "staff",
    sender_id: user.id,
    body,
  });
  if (error) backWithError(patientId, error.message);

  await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", thread!.id);

  await recordStaffAudit(supabase, "message.sent_to_patient", {
    patient_id: patientId,
    entity_type: "message",
    new_value: { about: "appointment_change" },
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

// ───── Documents ──────────────────────────────────────────────────────────

export async function uploadDocumentAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const category = String(formData.get("category") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const file = formData.get("file");

  if (!category) backWithError(patientId, "Pick a document category.");
  if (!(file instanceof File) || file.size === 0) {
    backWithError(patientId, "Choose a file to upload.");
  }
  const upload = file as File;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Path must start with the patient's id — Storage RLS keys ownership
  // off the first folder segment.
  const safeName = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${patientId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, upload, {
      contentType: upload.type || undefined,
      upsert: false,
    });
  if (uploadError) backWithError(patientId, uploadError.message);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      patient_id: patientId,
      category,
      title,
      filename: upload.name,
      storage_path: storagePath,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.document_uploaded", {
    patient_id: patientId,
    entity_type: "document",
    entity_id: data!.id,
    new_value: { category, filename: upload.name, title },
  });

  revalidatePath(`/patients/${patientId}`);
}

// ───── Discharge ──────────────────────────────────────────────────────────

// Discharges the patient — they drop out of the active-recovery lists.
export async function dischargePatientAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase
    .from("patients")
    .update({
      discharged_at: new Date().toISOString(),
      discharged_by_staff_id: user.id,
    })
    .eq("id", patientId);
  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.discharged", {
    patient_id: patientId,
    entity_type: "patient",
    entity_id: patientId,
  });
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/patients");
  revalidatePath("/");
}

// Re-admits a discharged patient back into active recovery.
export async function readmitPatientAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase
    .from("patients")
    .update({ discharged_at: null, discharged_by_staff_id: null })
    .eq("id", patientId);
  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.readmitted", {
    patient_id: patientId,
    entity_type: "patient",
    entity_id: patientId,
  });
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/patients");
  revalidatePath("/");
}

// ───── Custom pinned content ──────────────────────────────────────────────

// Pins either a content_items row (library pick) or an ad-hoc message to
// the patient's app home screen — never both.
export async function pinContentAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const contentId = String(formData.get("content_id") ?? "").trim();
  const adHoc = String(formData.get("ad_hoc_message") ?? "").trim();
  if (!contentId && !adHoc) {
    backWithError(patientId, "Pick a guide from the library or write a message.");
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.from("patient_pinned_content").insert({
    patient_id: patientId,
    kind: contentId ? "content" : "message",
    content_id: contentId || null,
    ad_hoc_message: adHoc || null,
    created_by_staff_id: user.id,
  });
  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.details_updated", {
    patient_id: patientId,
    entity_type: "patient_pinned_content",
    new_value: contentId
      ? { content_id: contentId, change: "pinned" }
      : { ad_hoc_message: adHoc, change: "pinned" },
  });
  revalidatePath(`/patients/${patientId}`);
}

export async function unpinContentAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backWithError(patientId, "Missing content id.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase
    .from("patient_pinned_content")
    .delete()
    .eq("id", id);
  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.details_updated", {
    patient_id: patientId,
    entity_type: "patient_pinned_content",
    entity_id: id,
    new_value: { change: "unpinned" },
  });
  revalidatePath(`/patients/${patientId}`);
}

// ───── Patient app feature overrides ──────────────────────────────────────

export async function setPatientFeatureOverrideAction(formData: FormData) {
  const patientId = readPatientId(formData);
  const featureKey = String(formData.get("feature_key") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";

  if (!FEATURE_BY_KEY.has(featureKey)) {
    backWithError(patientId, "Unknown feature.");
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // changed_by_staff_id marks this as an explicit staff override (vs the
  // NULL left by the activation snapshot).
  const { error } = await supabase.from("patient_feature_flags").upsert(
    {
      patient_id: patientId,
      feature_key: featureKey,
      enabled,
      changed_by_staff_id: user.id,
      changed_at: new Date().toISOString(),
    },
    { onConflict: "patient_id,feature_key" }
  );
  if (error) backWithError(patientId, error.message);

  await recordStaffAudit(supabase, "patient.feature_override_updated", {
    patient_id: patientId,
    entity_type: "patient_feature_flag",
    new_value: { feature_key: featureKey, enabled },
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

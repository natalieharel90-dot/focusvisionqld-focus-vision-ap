"use server";

import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { applyTemplateToPatient } from "@/lib/templates";
import { deriveStatus, freshChecklist } from "@/lib/setup-tasks";
import type { Database } from "@/types/database.types";

type EyeSide = Database["public"]["Enums"]["eye_side"];
const EYE_SIDES: ReadonlyArray<EyeSide> = ["left", "right", "both"];

// Dev default — the patient resets via email on first sign-in. A real
// onboarding flow would email a magic link instead.
const NEW_PATIENT_PASSWORD = "welcome-to-focus-vision";

function back(message: string): never {
  redirect(`/patients/new?error=${encodeURIComponent(message)}`);
}

export async function createPatientAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const dob = String(formData.get("date_of_birth") ?? "").trim() || null;
  const eye = String(formData.get("eye") ?? "") as EyeSide;
  const surgeryDate = String(formData.get("surgery_date") ?? "").trim();
  const templateId = String(formData.get("template_id") ?? "").trim();

  if (!name) back("Patient name is required.");
  if (!email) back("Email is required.");
  if (!EYE_SIDES.includes(eye)) back("Pick which eye(s).");
  if (!surgeryDate) back("Surgery date is required.");
  if (!templateId) back("Pick a procedure template.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Resolve the template — gives us surgeon + procedure, and lets us
  // refuse archived templates.
  const { data: template, error: templateError } = await supabase
    .from("procedure_templates")
    .select("id, surgeon_id, procedure_type, archived_at")
    .eq("id", templateId)
    .single();
  if (templateError) back(templateError.message);
  if (template.archived_at) {
    back("That template has been archived — pick another.");
  }

  // Bootstrap the patient's auth.users + auth.identities rows.
  const { data: newUserId, error: authError } = await supabase.rpc(
    "create_patient_auth_user",
    { p_email: email, p_password: NEW_PATIENT_PASSWORD }
  );
  if (authError) back(authError.message);
  const patientId = newUserId as string;

  const { error: patientError } = await supabase.from("patients").insert({
    id: patientId,
    email,
    phone,
    name,
    date_of_birth: dob,
  });
  if (patientError) back(patientError.message);

  // The procedure record — stamped with source_template_id.
  const { error: procedureError } = await supabase
    .from("procedures")
    .insert({
      patient_id: patientId,
      procedure_type: template.procedure_type,
      eye,
      surgeon_id: template.surgeon_id,
      surgery_date: surgeryDate,
      source_template_id: template.id,
      status: "active",
    });
  if (procedureError) back(procedureError.message);

  // Materialise the template's default medications + appointments.
  let applied: { medicationCount: number; appointmentCount: number };
  try {
    applied = await applyTemplateToPatient(supabase, {
      patientId,
      templateId: template.id,
      surgeryDate,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "Failed to apply template.");
  }

  // Open the messaging thread so the patient can reach the clinic.
  await supabase
    .from("message_threads")
    .insert({ patient_id: patientId, status: "open" });

  // Create the onboarding setup task. The template was just applied, so
  // template_applied starts done; MFA + the rest are pending — the
  // patient lands in the "MFA pending" kanban column.
  const setupChecklist = freshChecklist(new Date().toISOString());
  await supabase.from("patient_setup_tasks").insert({
    patient_id: patientId,
    status: deriveStatus(setupChecklist),
    checklist: setupChecklist,
  });

  await recordStaffAudit(supabase, "patient.created", {
    patient_id: patientId,
    entity_type: "patient",
    entity_id: patientId,
    new_value: {
      name,
      email,
      procedure_type: template.procedure_type,
    },
  });
  await recordStaffAudit(supabase, "patient.template_applied", {
    patient_id: patientId,
    entity_type: "procedure_template",
    entity_id: template.id,
    new_value: applied,
  });

  redirect(`/patients/${patientId}`);
}

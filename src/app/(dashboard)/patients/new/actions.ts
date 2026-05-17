"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";
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

// Service-role admin client — server-only, used to undo a partially-created
// patient if a step after auth-user creation fails. Returns null when the
// environment isn't configured for admin operations.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// Best-effort rollback of a half-created patient. createPatientAction does
// 5+ separate writes and can't be a real DB transaction from the client, so
// if a step fails mid-way we delete what was created — the patients row and
// the auth user — to avoid orphaned records. If cleanup itself fails the
// staff member is told the partial record exists so they can fix it.
async function cleanupAndFail(
  patientId: string,
  message: string
): Promise<never> {
  const admin = adminClient();
  let cleaned = false;
  if (admin) {
    // Delete the patients row first (it's referenced by the auth user via id).
    await admin.from("patients").delete().eq("id", patientId);
    const { error } = await admin.auth.admin.deleteUser(patientId);
    cleaned = !error;
  }
  if (cleaned) {
    back(message);
  }
  back(
    `${message} A partial patient record (id ${patientId}) could not be ` +
      `fully cleaned up — please remove it manually or contact an admin.`
  );
}

export async function createPatientAction(formData: FormData) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const dob = String(formData.get("date_of_birth") ?? "").trim() || null;
  const eye = String(formData.get("eye") ?? "") as EyeSide;
  const surgeryDate = String(formData.get("surgery_date") ?? "").trim();
  const templateId = String(formData.get("template_id") ?? "").trim();
  const facilityId = String(formData.get("facility_id") ?? "").trim() || null;

  if (!firstName) back("Patient first name is required.");
  if (!email) back("Email is required.");
  if (!EYE_SIDES.includes(eye)) back("Pick which eye(s).");
  if (!surgeryDate) back("Surgery date is required.");
  if (!templateId) back("Pick a procedure template.");

  const { supabase } = await requireStaff();

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

  // From here on the auth user exists — any failure must roll it (and the
  // patients row, once inserted) back to avoid orphaned records.
  const { error: patientError } = await supabase.from("patients").insert({
    id: patientId,
    email,
    phone,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dob,
  });
  if (patientError) await cleanupAndFail(patientId, patientError.message);

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
      facility_id: facilityId,
      status: "active",
    });
  if (procedureError) await cleanupAndFail(patientId, procedureError.message);

  // Materialise the template's default medications + appointments.
  let applied: { medicationCount: number; appointmentCount: number };
  try {
    applied = await applyTemplateToPatient(supabase, {
      patientId,
      templateId: template.id,
      surgeryDate,
    });
  } catch (err) {
    await cleanupAndFail(
      patientId,
      err instanceof Error ? err.message : "Failed to apply template."
    );
    // cleanupAndFail always redirects (throws) — unreachable, satisfies CFA.
    throw err;
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
      first_name: firstName,
      last_name: lastName,
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  parseTemplateAppointments,
  parseTemplateMedications,
} from "@/lib/templates";

function backToEditor(templateId: string | null, message: string): never {
  const path = templateId
    ? `/procedures/${templateId}`
    : "/procedures/new";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// Handles both create and update. template_id empty ⇒ create.
export async function saveTemplateAction(formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "").trim() || null;
  const surgeonId = String(formData.get("surgeon_id") ?? "").trim();
  const procedureType = String(formData.get("procedure_type") ?? "").trim();
  const medicationsJson = String(formData.get("default_medications") ?? "[]");
  const appointmentsJson = String(formData.get("default_appointments") ?? "[]");
  const linkedRulesetId =
    String(formData.get("linked_routing_ruleset_id") ?? "").trim() || null;

  if (!surgeonId) backToEditor(templateId, "Surgeon is required.");
  if (!procedureType) backToEditor(templateId, "Procedure type is required.");

  // Validate the JSON payloads by round-tripping through the parsers.
  let medications: unknown;
  let appointments: unknown;
  try {
    medications = JSON.parse(medicationsJson);
    appointments = JSON.parse(appointmentsJson);
  } catch {
    backToEditor(templateId, "Could not read the medication/appointment data.");
  }
  const cleanMeds = parseTemplateMedications(medications);
  const cleanAppts = parseTemplateAppointments(appointments);

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  if (templateId) {
    const { data: before } = await supabase
      .from("procedure_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    const { error } = await supabase
      .from("procedure_templates")
      .update({
        default_medications: cleanMeds,
        default_appointments: cleanAppts,
        linked_routing_ruleset_id: linkedRulesetId,
        updated_by: user.id,
      })
      .eq("id", templateId);
    if (error) backToEditor(templateId, error.message);

    await recordStaffAudit(supabase, "settings.template_updated", {
      entity_type: "procedure_template",
      entity_id: templateId,
      old_value: before,
      new_value: {
        medication_count: cleanMeds.length,
        appointment_count: cleanAppts.length,
        linked_routing_ruleset_id: linkedRulesetId,
      },
    });

    revalidatePath("/procedures");
    revalidatePath(`/procedures/${templateId}`);
    redirect(`/procedures/${templateId}?saved=1`);
  }

  // Create
  const { data: created, error } = await supabase
    .from("procedure_templates")
    .insert({
      surgeon_id: surgeonId,
      procedure_type: procedureType,
      default_medications: cleanMeds,
      default_appointments: cleanAppts,
      linked_routing_ruleset_id: linkedRulesetId,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error) backToEditor(null, error.message);

  await recordStaffAudit(supabase, "settings.template_created", {
    entity_type: "procedure_template",
    entity_id: created!.id,
    new_value: {
      surgeon_id: surgeonId,
      procedure_type: procedureType,
      medication_count: cleanMeds.length,
      appointment_count: cleanAppts.length,
    },
  });

  revalidatePath("/procedures");
  redirect(`/procedures/${created!.id}?saved=1`);
}

// Soft-delete: set archived_at. Never hard-deletes, so historical
// patients keep their source_template_id linkage.
export async function archiveTemplateAction(formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "").trim();
  if (!templateId) redirect("/procedures");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase
    .from("procedure_templates")
    .update({ archived_at: new Date().toISOString(), archived_by: user.id })
    .eq("id", templateId);
  if (error) backToEditor(templateId, error.message);

  await recordStaffAudit(supabase, "settings.template_archived", {
    entity_type: "procedure_template",
    entity_id: templateId,
  });

  revalidatePath("/procedures");
  redirect("/procedures");
}

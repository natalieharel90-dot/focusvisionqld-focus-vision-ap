import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";

export type StaffAuditEventType =
  | "staff.signed_in"
  | "staff.signed_out"
  | "staff.created"
  | "patient.procedure_added"
  | "patient.medication_added"
  | "patient.medication_stopped"
  | "patient.appointment_scheduled"
  | "patient.note_added"
  | "patient.flag_raised"
  | "patient.flag_resolved"
  | "patient.check_in_reviewed"
  | "message.sent_to_patient"
  | "message.thread_resolved"
  | "settings.routing_rules_updated"
  | "settings.alert_actions_updated"
  | "settings.symptom_added"
  | "settings.symptom_toggled"
  | "settings.recovery_guidance_updated"
  | "settings.template_created"
  | "settings.template_updated"
  | "settings.template_archived"
  | "patient.created"
  | "patient.details_updated"
  | "patient.template_applied"
  | "audit.viewed"
  | "audit.exported"
  | "patient.setup_item_completed"
  | "patient.activated"
  | "analytics.viewed"
  | "analytics.exported"
  | "analytics.refreshed"
  | "staff.theme_changed"
  | "staff.bonus_pack_unlocked"
  | "bulkpush.sent"
  | "patient.document_uploaded"
  | "settings.contact_options_updated"
  | "feedback.acknowledged"
  | "settings.feature_default_updated"
  | "patient.feature_override_updated"
  | "patient.appointment_updated"
  | "settings.clinic_profile_updated"
  | "settings.doctor_updated"
  | "settings.facility_updated"
  | "settings.message_template_updated"
  | "settings.content_item_updated"
  | "report.generated";

type ExtraAuditFields = {
  patient_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  old_value?: Json | null;
  new_value?: Json | null;
};

// Inserts an audit_events row attributed to the currently authenticated
// staff user. Looks up the user + role internally so callers don't have to.
// Relies on the RLS policy (audit_events_insert) to enforce that
// actor_staff_id = auth.uid() and that the actor is_staff().
//
// Never throws — a failed audit log shouldn't break a user-facing action.
// Failures are logged for the operator to investigate.
export async function recordStaffAudit(
  supabase: SupabaseClient<Database>,
  eventType: StaffAuditEventType,
  extras: ExtraAuditFields = {}
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[audit] no authenticated user", { eventType });
    return;
  }

  const { data: staff } = await supabase
    .from("staff_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const h = headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent");

  const { error } = await supabase.from("audit_events").insert({
    actor_staff_id: user.id,
    actor_role: staff?.role ?? null,
    event_type: eventType,
    patient_id: extras.patient_id ?? null,
    entity_type: extras.entity_type ?? null,
    entity_id: extras.entity_id ?? null,
    old_value: extras.old_value ?? null,
    new_value: extras.new_value ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (error) {
    console.error("[audit] insert failed", {
      eventType,
      actorStaffId: user.id,
      code: error.code,
      message: error.message,
    });
  }
}

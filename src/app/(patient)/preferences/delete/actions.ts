"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// Records a patient-initiated account-deletion request. Deletion isn't
// automatic — clinical records must be retained per Australian health law,
// so the request is logged as a patient-actor audit event for the care
// team to action.
export async function requestAccountDeletionAction(formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  await supabase.rpc("record_patient_audit_event", {
    p_event_type: "patient.account_deletion_requested",
    p_entity_type: "patient",
    p_entity_id: user.id,
    p_new_value: { reason, requested_at: new Date().toISOString() },
  });

  redirect("/preferences/delete?done=1");
}

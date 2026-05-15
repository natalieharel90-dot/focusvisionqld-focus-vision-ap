"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// Records a tap-to-call on the Contact screen, for clinic analytics
// ("how many patients called in week 1 vs week 4"). Fire-and-forget from
// the client — failure must never block the call.
export async function logContactCallTapAction(
  optionId: string
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("record_patient_audit_event", {
    p_event_type: "patient.clinic_call_tapped",
    p_entity_type: "contact_option",
    p_new_value: {},
    p_entity_id: optionId,
  });
}

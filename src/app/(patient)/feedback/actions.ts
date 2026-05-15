"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { feedbackRowsToWrite, type FeedbackSection } from "@/lib/feedback";

export type SubmitFeedbackResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

// Writes one feedback row per rated section (spec §5.9). Each row is
// audit-logged as a patient-actor event.
export async function submitFeedbackAction(
  sections: FeedbackSection[]
): Promise<SubmitFeedbackResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const rows = feedbackRowsToWrite(sections);
  if (rows.length === 0) {
    return { ok: false, error: "Rate at least one section before submitting." };
  }

  // Snapshot the patient's recovery day at submission time.
  const { data: procedure } = await supabase
    .from("procedures")
    .select("surgery_date")
    .eq("patient_id", user.id)
    .eq("status", "active")
    .order("surgery_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const recoveryDay = procedure?.surgery_date
    ? Math.floor(
        (Date.now() -
          new Date(`${procedure.surgery_date}T00:00:00Z`).getTime()) /
          86_400_000
      )
    : null;

  for (const section of rows) {
    const { data: inserted, error } = await supabase
      .from("feedback")
      .insert({
        patient_id: user.id,
        target: section.target,
        rating: section.rating,
        comment: section.comment.trim() || null,
        staff_mention: section.staffMention.trim() || null,
        contact_requested: section.contactRequested,
        recovery_day: recoveryDay,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return { ok: false, error: error?.message ?? "Could not save feedback." };
    }

    await supabase.rpc("record_patient_audit_event", {
      p_event_type: "patient.feedback_submitted",
      p_entity_type: "feedback",
      p_new_value: { target: section.target, rating: section.rating },
      p_entity_id: inserted.id,
    });
  }

  return { ok: true, count: rows.length };
}

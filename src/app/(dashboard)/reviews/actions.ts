"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Replies to a feedback row: sends the staff message into the patient's
// thread and marks the feedback acknowledged (spec §5.9 staff side).
export async function replyToFeedbackAction(formData: FormData) {
  const feedbackId = String(formData.get("feedback_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  // Preserve the staff member's filter + search when we redirect back.
  const params = new URLSearchParams();
  const filter = String(formData.get("filter") ?? "").trim();
  const q = String(formData.get("q") ?? "").trim();
  const page = String(formData.get("page") ?? "").trim();
  if (filter && filter !== "all") params.set("filter", filter);
  if (q) params.set("q", q);
  if (page && page !== "1") params.set("page", page);
  const reviewsUrl = (extra?: string) => {
    const p = new URLSearchParams(params);
    if (extra) p.set("error", extra);
    const s = p.toString();
    return `/reviews${s ? `?${s}` : ""}`;
  };

  const back = (msg?: string): never => redirect(reviewsUrl(msg));

  if (!feedbackId) back("Missing feedback id.");
  if (!body) back("Write a reply before sending.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: feedback } = await supabase
    .from("feedback")
    .select("id, patient_id, acknowledged_at")
    .eq("id", feedbackId)
    .maybeSingle();
  if (!feedback) back("Feedback not found.");

  // Ensure the patient has a message thread.
  let { data: thread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("patient_id", feedback!.patient_id)
    .maybeSingle();
  if (!thread) {
    const { data: created } = await supabase
      .from("message_threads")
      .insert({ patient_id: feedback!.patient_id })
      .select("id")
      .single();
    thread = created ?? null;
  }
  if (!thread) back("Could not open the patient's message thread.");

  const { error: messageError } = await supabase.from("messages").insert({
    thread_id: thread!.id,
    sender_type: "staff",
    sender_id: user.id,
    body,
  });
  if (messageError) back(messageError.message);

  await supabase
    .from("message_threads")
    .update({
      last_message_at: new Date().toISOString(),
    })
    .eq("id", thread!.id);

  const { error: ackError } = await supabase
    .from("feedback")
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_staff_id: user.id,
    })
    .eq("id", feedbackId);
  if (ackError) back(ackError.message);

  await recordStaffAudit(supabase, "feedback.acknowledged", {
    patient_id: feedback!.patient_id,
    entity_type: "feedback",
    entity_id: feedbackId,
    new_value: { replied: true },
  });

  revalidatePath("/reviews");
  redirect(reviewsUrl());
}

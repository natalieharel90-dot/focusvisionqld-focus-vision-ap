"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";
import { sendPush } from "@/lib/push";

function back(threadId: string, message: string): never {
  redirect(
    `/staff-app/messages/${threadId}?error=${encodeURIComponent(message)}`
  );
}

// Sends a staff reply from within the staff mobile app and stays in it
// (the dashboard inbox action redirects back to /inbox).
export async function sendStaffAppMessageAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId) redirect("/staff-app/messages");
  if (!body) redirect(`/staff-app/messages/${threadId}`);

  const { supabase, userId } = await requireStaff();

  const { data: thread, error: threadError } = await supabase
    .from("message_threads")
    .select("patient_id")
    .eq("id", threadId)
    .maybeSingle();
  if (threadError) {
    back(threadId, `Couldn't open the conversation: ${threadError.message}`);
  }
  if (!thread) back(threadId, "This conversation could no longer be found.");

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      thread_id: threadId,
      sender_type: "staff",
      sender_id: userId,
      body,
      attachments: [],
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[staff-app] send failed", error);
    back(threadId, error?.message ?? "The message could not be saved.");
  }

  await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  await recordStaffAudit(supabase, "message.sent_to_patient", {
    patient_id: thread.patient_id,
    entity_type: "message",
    entity_id: inserted.id,
    new_value: { body_length: body.length },
  });

  // Notify the patient's devices. Deliberately generic — no message
  // content on the lock screen.
  await sendPush(thread.patient_id, {
    title: "Focus Vision",
    body: "You have a new message from your care team.",
    url: "/messages",
    tag: "message",
  });

  revalidatePath(`/staff-app/messages/${threadId}`);
  redirect(`/staff-app/messages/${threadId}`);
}

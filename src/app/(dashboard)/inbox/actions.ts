"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";
import { sendPush } from "@/lib/push";
import type { Database } from "@/types/database.types";

const VALID_NOTIFICATION_PREFS = [
  "notify_new_message",
  "notify_orange_flag",
  "notify_yellow_flag",
  "quiet_hours",
  "daily_digest_email",
] as const;

function back(threadId: string, message: string): never {
  redirect(`/inbox?thread=${threadId}&error=${encodeURIComponent(message)}`);
}

export async function sendStaffMessageAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const attachmentPath = String(formData.get("attachment_path") ?? "").trim();

  if (!threadId) redirect("/inbox");
  if (!body && !attachmentPath) back(threadId, "Type a reply before sending.");

  const { supabase, userId } = await requireStaff();

  // Fetch the thread's patient id so we can audit-log against them.
  const { data: thread, error: threadError } = await supabase
    .from("message_threads")
    .select("patient_id")
    .eq("id", threadId)
    .single();
  if (threadError) back(threadId, threadError.message);

  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      thread_id: threadId,
      sender_type: "staff",
      sender_id: userId,
      body,
      attachments: attachmentPath ? [attachmentPath] : [],
    })
    .select("id")
    .single();
  if (insertError) back(threadId, insertError.message);

  await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  await recordStaffAudit(supabase, "message.sent_to_patient", {
    patient_id: thread!.patient_id,
    entity_type: "message",
    entity_id: inserted!.id,
    new_value: { body_length: body.length, has_attachment: !!attachmentPath },
  });

  // Notify the patient's devices. Deliberately generic — no message
  // content on the lock screen.
  await sendPush(thread!.patient_id, {
    title: "Focus Vision",
    body: "You have a new message from your care team.",
    url: "/messages",
    tag: "message",
  });

  revalidatePath("/inbox");
  redirect(`/inbox?thread=${threadId}`);
}

// Toggles one of the signed-in staff member's notification preferences.
// Returns to the same inbox state — no redirect, the page re-renders.
export async function toggleNotificationPrefAction(formData: FormData) {
  const pref = String(formData.get("pref") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!(VALID_NOTIFICATION_PREFS as readonly string[]).includes(pref)) return;

  const { supabase, userId } = await requireStaff();

  // pref is validated against the column allow-list above.
  const patch = {
    staff_id: userId,
    [pref]: enabled,
  } as Database["public"]["Tables"]["staff_notification_prefs"]["Insert"];

  const { error } = await supabase
    .from("staff_notification_prefs")
    .upsert(patch, { onConflict: "staff_id" });
  if (error) {
    console.error("[notification-prefs] upsert failed", error.message);
    return;
  }

  await recordStaffAudit(supabase, "settings.notification_prefs_updated", {
    entity_type: "staff_notification_prefs",
    new_value: { [pref]: enabled },
  });

  revalidatePath("/inbox");
  revalidatePath("/staff-app/me");
}

// Marks a thread resolved — it drops out of the unread count and the
// default inbox filter. Threads re-open automatically isn't modelled;
// staff reply still works on a resolved thread.
export async function resolveThreadAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "");
  if (!threadId) redirect("/inbox");

  const { supabase } = await requireStaff();

  const { data: thread, error } = await supabase
    .from("message_threads")
    .select("patient_id")
    .eq("id", threadId)
    .single();
  if (error) back(threadId, error.message);

  const { error: updateError } = await supabase
    .from("message_threads")
    .update({ status: "resolved" })
    .eq("id", threadId);
  if (updateError) back(threadId, updateError.message);

  await recordStaffAudit(supabase, "message.thread_resolved", {
    patient_id: thread!.patient_id,
    entity_type: "message_thread",
    entity_id: threadId,
  });

  revalidatePath("/inbox");
  redirect(`/inbox?thread=${threadId}`);
}

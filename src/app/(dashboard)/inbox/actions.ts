"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function back(threadId: string, message: string): never {
  redirect(`/inbox?thread=${threadId}&error=${encodeURIComponent(message)}`);
}

export async function sendStaffMessageAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const attachmentPath = String(formData.get("attachment_path") ?? "").trim();

  if (!threadId) redirect("/inbox");
  if (!body && !attachmentPath) back(threadId, "Type a reply before sending.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

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
      sender_id: user.id,
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

  revalidatePath("/inbox");
  redirect(`/inbox?thread=${threadId}`);
}

// Marks a thread resolved — it drops out of the unread count and the
// default inbox filter. Threads re-open automatically isn't modelled;
// staff reply still works on a resolved thread.
export async function resolveThreadAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "");
  if (!threadId) redirect("/inbox");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

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

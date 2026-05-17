"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

function back(message: string): never {
  redirect(`/messages?error=${encodeURIComponent(message)}`);
}

async function ensureThreadId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  patientId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("message_threads")
    .insert({ patient_id: patientId, status: "open" })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function sendPatientMessageAction(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  const attachmentPath = String(formData.get("attachment_path") ?? "").trim();
  if (!body && !attachmentPath) back("Type a message before sending.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const threadId = await ensureThreadId(supabase, user.id);

  const { error: insertError } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_type: "patient",
    sender_id: user.id,
    body,
    attachments: attachmentPath ? [attachmentPath] : [],
  });
  if (insertError) {
    console.error("[messages] send failed", insertError);
    back("Your message couldn't be sent. Please try again.");
  }

  await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  revalidatePath("/messages");
}

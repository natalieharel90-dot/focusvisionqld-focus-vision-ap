import { redirect } from "next/navigation";

import { MessageList } from "@/components/chat/MessageList";
import { ThreadRealtime } from "@/components/chat/ThreadRealtime";
import { AttachmentField } from "@/components/chat/AttachmentField";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  attachmentPathsFrom,
  signMessageAttachments,
  type MessageAttachment,
} from "@/lib/messages";
import { sendPatientMessageAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PatientMessagesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  // Lazy thread creation — most patients have one from seed/onboarding,
  // but a fresh patient lands here without one.
  let { data: thread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("patient_id", user.id)
    .maybeSingle();
  if (!thread) {
    const { data: created } = await supabase
      .from("message_threads")
      .insert({ patient_id: user.id, status: "open" })
      .select("id")
      .single();
    thread = created ?? null;
  }
  if (!thread) {
    return (
      <main className="px-5 py-6">
        <p className="text-sm text-red-700">
          Couldn&apos;t open your messages thread. Please try again.
        </p>
      </main>
    );
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("sent_at", { ascending: true });
  const msgs = messages ?? [];

  // Mark inbound messages as read. Patients have no UPDATE grant on
  // messages / message_threads, so this goes through a SECURITY DEFINER
  // RPC; setting read_at also feeds bulk-push open tracking.
  const hasUnread = msgs.some(
    (m) => m.sender_type === "staff" && m.read_at === null
  );
  if (hasUnread) {
    await supabase.rpc("mark_thread_read", { p_thread_id: thread.id });
  }

  // Resolve staff who participated so we can show name + role labels.
  const staffIds = Array.from(
    new Set(
      msgs.filter((m) => m.sender_type === "staff").map((m) => m.sender_id)
    )
  );
  const staffResult =
    staffIds.length > 0
      ? await supabase
          .from("staff_users")
          .select("id, name, role")
          .in("id", staffIds)
      : { data: [] };
  const staffById = new Map(
    (staffResult.data ?? []).map((s) => [s.id, s])
  );

  // Sign attachment URLs (each message's attachments JSON → paths → signed).
  const allPaths = msgs.flatMap((m) => attachmentPathsFrom(m.attachments));
  const signed = await signMessageAttachments(supabase, allPaths);
  const signedByPath = new Map(signed.map((s) => [s.path, s]));
  const signedAttachmentsByMessage = new Map<
    string,
    ReadonlyArray<MessageAttachment>
  >();
  for (const m of msgs) {
    const paths = attachmentPathsFrom(m.attachments);
    signedAttachmentsByMessage.set(
      m.id,
      paths.map((p) => signedByPath.get(p) ?? { path: p, signed_url: null })
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-7rem)] flex-col gap-4 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Messages
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          The Focus Vision care team. We usually reply within a few hours
          during clinic hours.
        </p>
      </header>

      <ThreadRealtime
        threadId={thread.id}
        viewerType="patient"
        notificationTitle="New message from Focus Vision"
      />

      {searchParams.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <div className="flex-1">
        <MessageList
          messages={msgs}
          staffById={staffById}
          signedAttachmentsByMessage={signedAttachmentsByMessage}
          viewerType="patient"
        />
      </div>

      <form
        action={sendPatientMessageAction}
        className="sticky bottom-20 flex flex-col gap-2 rounded-2xl bg-fv-bg-card p-3 shadow-sm"
      >
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Type a message…"
          className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <AttachmentField bucket="message-attachments" folder={thread.id} />
          <button
            type="submit"
            className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}

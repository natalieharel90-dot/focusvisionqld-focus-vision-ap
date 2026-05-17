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
    <main className="flex min-h-[calc(100vh-5rem)] flex-col">
      {/* Conversation header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-fv-border bg-fv-bg-card px-5 py-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-sm font-bold tracking-wide text-white">
          FV
        </span>
        <div className="min-w-0">
          <div className="font-bold text-fv-text-primary">
            Focus Vision team
          </div>
          <div className="flex items-center gap-1.5 text-sm text-fv-accent-strong">
            <span className="h-2 w-2 rounded-full bg-fv-accent-strong" />
            Usually replies within 2 hours
          </div>
        </div>
      </header>

      <ThreadRealtime
        threadId={thread.id}
        viewerType="patient"
        notificationTitle="New message from Focus Vision"
      />

      {searchParams.error ? (
        <p className="mx-5 mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {/* Messages */}
      <div className="flex-1 px-5 py-4">
        <MessageList
          messages={msgs}
          staffById={staffById}
          signedAttachmentsByMessage={signedAttachmentsByMessage}
          viewerType="patient"
        />
      </div>

      {/* Composer */}
      <form
        action={sendPatientMessageAction}
        className="sticky bottom-20 flex items-center gap-2 border-t border-fv-border bg-fv-bg-card px-3 py-3"
      >
        <AttachmentField
          bucket="message-attachments"
          folder={thread.id}
          compact
        />
        <textarea
          name="body"
          rows={1}
          required
          placeholder="Type a message…"
          className="min-w-0 flex-1 resize-none rounded-full border border-fv-border bg-fv-bg-app px-4 py-2.5 text-sm text-fv-text-primary placeholder:text-fv-text-secondary"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-white hover:opacity-95"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
    </main>
  );
}

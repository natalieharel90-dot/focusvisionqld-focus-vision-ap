import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MessageList } from "@/components/chat/MessageList";
import { ThreadRealtime } from "@/components/chat/ThreadRealtime";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  attachmentPathsFrom,
  signMessageAttachments,
  type MessageAttachment,
} from "@/lib/messages";
import { StaffComposer } from "./StaffComposer";

export const dynamic = "force-dynamic";

export default async function StaffThreadDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const threadId = params.id;

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, patient_id, status, patients(name)")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) notFound();
  const patient = thread.patients as { name: string } | null;

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true });
  const msgs = messages ?? [];

  // Mark inbound (patient) messages read via the SECURITY DEFINER RPC —
  // staff have no UPDATE grant on messages.
  const hasUnread = msgs.some(
    (m) => m.sender_type === "patient" && m.read_at === null
  );
  if (hasUnread) {
    await supabase.rpc("mark_thread_read", { p_thread_id: threadId });
  }

  // Staff who've sent in this thread, for name + role labels.
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

  // Attachments — signed URLs.
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

  // Quick-reply templates.
  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, label, body, category")
    .order("label");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-8">
      <div>
        <Link
          href="/inbox"
          className="text-xs font-semibold text-fv-text-secondary hover:underline"
        >
          ← Inbox
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-fv-text-primary">
            {patient?.name ?? "Unknown patient"}
          </h1>
          <Link
            href={`/patients/${thread.patient_id}`}
            className="text-xs font-semibold text-fv-accent-strong hover:underline"
          >
            View patient record →
          </Link>
        </div>
      </div>

      <ThreadRealtime
        threadId={thread.id}
        viewerType="staff"
        notificationTitle={`New message from ${patient?.name ?? "patient"}`}
      />

      {searchParams.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <div className="rounded-xl bg-fv-bg-soft p-4">
        <MessageList
          messages={msgs}
          staffById={staffById}
          signedAttachmentsByMessage={signedAttachmentsByMessage}
          viewerType="staff"
        />
      </div>

      <StaffComposer threadId={thread.id} templates={templates ?? []} />
    </main>
  );
}

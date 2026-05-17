import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { MessageList } from "@/components/chat/MessageList";
import {
  attachmentPathsFrom,
  signMessageAttachments,
  type MessageAttachment,
} from "@/lib/messages";
import { sendStaffAppMessageAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffAppThreadPage({
  params,
  searchParams,
}: {
  params: { threadId: string };
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, patient_id")
    .eq("id", params.threadId)
    .maybeSingle();
  if (!thread) notFound();

  const { data: patient } = await supabase
    .from("patients")
    .select("name")
    .eq("id", thread.patient_id)
    .maybeSingle();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("sent_at", { ascending: true });
  const msgs = messages ?? [];

  // Best-effort: clear the staff-unread count now the thread is open.
  await supabase
    .from("message_threads")
    .update({ unread_for_staff: 0 })
    .eq("id", thread.id);

  // Resolve staff names for the message labels.
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

  // Sign attachment URLs for display.
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
    <div className="flex flex-col">
      {/* Sub-header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-fv-bg-soft bg-fv-bg-card px-3 py-2.5">
        <Link
          href="/staff-app/messages"
          aria-label="Back to messages"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fv-text-secondary hover:bg-fv-bg-soft"
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
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <span className="truncate font-semibold text-fv-text-primary">
          {patient?.name ?? "Patient"}
        </span>
      </div>

      <div className="flex-1 px-4 py-3">
        <MessageList
          messages={msgs}
          staffById={staffById}
          signedAttachmentsByMessage={signedAttachmentsByMessage}
          viewerType="staff"
        />
      </div>

      <form
        action={sendStaffAppMessageAction}
        className="sticky bottom-20 flex items-center gap-2 border-t border-fv-bg-soft bg-fv-bg-card px-3 py-2.5"
      >
        <input type="hidden" name="thread_id" value={thread.id} />
        <textarea
          name="body"
          rows={1}
          required
          placeholder="Type a reply…"
          className="min-w-0 flex-1 resize-none rounded-full border border-fv-border bg-fv-bg-app px-4 py-2 text-sm text-fv-text-primary placeholder:text-fv-text-secondary"
        />
        <button
          type="submit"
          aria-label="Send reply"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-white"
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

      {searchParams.error ? (
        <p className="px-4 pb-2 text-center text-xs text-amber-700">
          Your reply couldn&apos;t be sent — please try again.
        </p>
      ) : null}
    </div>
  );
}

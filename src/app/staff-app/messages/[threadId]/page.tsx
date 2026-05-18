import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { MessageAttachments } from "@/components/chat/MessageAttachments";
import {
  attachmentPathsFrom,
  signMessageAttachments,
  type MessageAttachment,
} from "@/lib/messages";
import { initials } from "@/lib/bulk-push";
import { sendStaffAppMessageAction } from "./actions";

export const dynamic = "force-dynamic";

const ZONE_LABEL: Record<string, string> = {
  green: "Green",
  yellow: "Yellow",
  orange: "Orange",
};

function fmtTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Australia/Brisbane",
    })
    .toUpperCase();
}

function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor(
    (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000
  );
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

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

  const [patientRes, procedureRes, checkInRes, messagesRes] =
    await Promise.all([
      supabase
        .from("patients")
        .select("name")
        .eq("id", thread.patient_id)
        .maybeSingle(),
      supabase
        .from("procedures")
        .select("procedure_type, surgeon_id, surgery_date")
        .eq("patient_id", thread.patient_id)
        .eq("status", "active")
        .order("surgery_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("check_ins")
        .select("patient_zone, recovery_day")
        .eq("patient_id", thread.patient_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("sent_at", { ascending: true }),
    ]);

  const patientName = patientRes.data?.name ?? "Patient";
  const procedure = procedureRes.data;
  const latest = checkInRes.data;
  const msgs = messagesRes.data ?? [];

  // Best-effort: clear the staff-unread count now the thread is open.
  await supabase
    .from("message_threads")
    .update({ unread_for_staff: 0 })
    .eq("id", thread.id);

  // Surgeon name for the context line.
  let surgeonName: string | null = null;
  if (procedure) {
    const { data: surgeon } = await supabase
      .from("staff_users")
      .select("name, display_name")
      .eq("id", procedure.surgeon_id)
      .maybeSingle();
    surgeonName = surgeon?.display_name || surgeon?.name || null;
  }

  // Context line: Day N · PROCEDURE · Surgeon · Zone today.
  const day =
    latest?.recovery_day ?? daysSince(procedure?.surgery_date ?? null);
  const contextParts = [
    day != null ? `Day ${day}` : null,
    procedure?.procedure_type?.toUpperCase() ?? null,
    surgeonName,
    latest?.patient_zone
      ? `${ZONE_LABEL[latest.patient_zone] ?? "Green"} zone today`
      : null,
  ].filter(Boolean);

  // Resolve staff names for outbound message labels.
  const staffIds = Array.from(
    new Set(
      msgs.filter((m) => m.sender_type === "staff").map((m) => m.sender_id)
    )
  );
  const staffResult =
    staffIds.length > 0
      ? await supabase
          .from("staff_users")
          .select("id, name")
          .in("id", staffIds)
      : { data: [] };
  const staffName = new Map(
    (staffResult.data ?? []).map((s) => [s.id, s.name])
  );

  // Sign attachment URLs for display.
  const allPaths = msgs.flatMap((m) => attachmentPathsFrom(m.attachments));
  const signed = await signMessageAttachments(supabase, allPaths);
  const signedByPath = new Map(signed.map((s) => [s.path, s]));
  const signedFor = (id: string): ReadonlyArray<MessageAttachment> => {
    const m = msgs.find((x) => x.id === id);
    if (!m) return [];
    return attachmentPathsFrom(m.attachments).map(
      (p) => signedByPath.get(p) ?? { path: p, signed_url: null }
    );
  };

  return (
    <div className="flex flex-col">
      {/* Thread sub-header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-fv-bg-soft bg-fv-bg-card px-3 py-2.5">
        <Link
          href="/staff-app/messages"
          aria-label="Back to messages"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fv-accent-strong hover:bg-fv-bg-soft"
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
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-xs font-semibold text-white">
          {initials(patientName)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-semibold text-fv-text-primary">
            {patientName}
          </div>
          {contextParts.length > 0 ? (
            <div className="truncate text-xs text-fv-text-secondary">
              {contextParts.join(" · ")}
            </div>
          ) : null}
        </div>
      </div>

      {/* Conversation */}
      <ul className="flex flex-1 flex-col gap-3 px-4 py-4">
        {msgs.length === 0 ? (
          <li className="py-8 text-center text-sm text-fv-text-secondary">
            No messages yet.
          </li>
        ) : (
          msgs.map((m) => {
            const isStaff = m.sender_type === "staff";
            const sender = isStaff
              ? (staffName.get(m.sender_id) ?? "Focus Vision")
              : patientName;
            return (
              <li
                key={m.id}
                className={`flex flex-col ${
                  isStaff ? "items-end" : "items-start"
                }`}
              >
                <span className="mb-1 px-1 text-xs text-fv-text-secondary">
                  {firstName(sender)} · {fmtTime(m.sent_at)}
                </span>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    isStaff
                      ? "bg-fv-accent-strong text-white"
                      : "border border-fv-border bg-fv-bg-card text-fv-text-primary"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <MessageAttachments attachments={signedFor(m.id)} />
                </div>
              </li>
            );
          })
        )}
      </ul>

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
          Couldn&apos;t send: {searchParams.error}
        </p>
      ) : null}
    </div>
  );
}

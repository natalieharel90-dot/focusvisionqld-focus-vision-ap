import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function StaffInboxPage() {
  const supabase = createSupabaseServerClient();

  // All threads, newest activity first. Patient name comes via the FK join.
  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, patient_id, status, last_message_at, patients(name)")
    .order("last_message_at", { ascending: false, nullsFirst: false });

  // Last message body per thread + unread count from patient. One query
  // each — small N, simpler than aggregation.
  const threadIds = (threads ?? []).map((t) => t.id);

  const { data: lastMessages } =
    threadIds.length > 0
      ? await supabase
          .from("messages")
          .select("thread_id, body, sender_type, sent_at")
          .in("thread_id", threadIds)
          .order("sent_at", { ascending: false })
      : { data: [] };
  // Take first occurrence per thread.
  const lastByThread = new Map<
    string,
    { body: string; sender_type: string; sent_at: string }
  >();
  for (const m of lastMessages ?? []) {
    if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
  }

  const { data: unreadRows } =
    threadIds.length > 0
      ? await supabase
          .from("messages")
          .select("thread_id")
          .in("thread_id", threadIds)
          .eq("sender_type", "patient")
          .is("read_at", null)
      : { data: [] };
  const unreadByThread = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    unreadByThread.set(r.thread_id, (unreadByThread.get(r.thread_id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between pb-6">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Inbox
        </h1>
        <span className="text-sm text-fv-text-secondary">
          {(threads ?? []).length} threads
        </span>
      </div>

      <ul className="divide-y divide-fv-bg-soft overflow-hidden rounded-xl bg-fv-bg-card shadow-sm">
        {(threads ?? []).map((t) => {
          const last = lastByThread.get(t.id);
          const unread = unreadByThread.get(t.id) ?? 0;
          const patient = t.patients as { name: string } | null;
          return (
            <li key={t.id}>
              <Link
                href={`/inbox/${t.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-fv-bg-soft"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fv-text-primary">
                      {patient?.name ?? "Unknown patient"}
                    </span>
                    {unread > 0 ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                        {unread} new
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-sm text-fv-text-secondary">
                    {last
                      ? `${last.sender_type === "patient" ? "" : "You: "}${last.body}`
                      : "(no messages yet)"}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-fv-text-secondary">
                  {fmt(t.last_message_at)}
                </span>
              </Link>
            </li>
          );
        })}
        {(threads ?? []).length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-fv-text-secondary">
            No patient threads yet.
          </li>
        ) : null}
      </ul>
    </main>
  );
}

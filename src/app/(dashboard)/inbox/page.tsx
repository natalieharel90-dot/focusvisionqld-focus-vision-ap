import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import {
  attachmentPathsFrom,
  signMessageAttachments,
  type MessageAttachment,
} from "@/lib/messages";
import type { Database } from "@/types/database.types";
import { ThreadRealtime } from "@/components/chat/ThreadRealtime";
import { StaffComposer } from "./StaffComposer";
import { InboxFilter } from "./InboxFilter";
import { ComingSoonButton } from "./ComingSoonButton";
import { resolveThreadAction, toggleNotificationPrefAction } from "./actions";

export const dynamic = "force-dynamic";

// Per-staff notification options shown at the foot of the Messages page.
const NOTIFICATION_PREFS = [
  {
    key: "notify_new_message",
    label: "Push notification — new patient message",
    desc: "Wakes your phone when any patient sends a message",
    fallback: true,
  },
  {
    key: "notify_orange_flag",
    label: "Push notification — Orange zone flag",
    desc: "Highest-concern patient flags only",
    fallback: true,
  },
  {
    key: "notify_yellow_flag",
    label: "Push notification — Yellow zone flag",
    desc: "Mid-concern patient flags",
    fallback: false,
  },
  {
    key: "quiet_hours",
    label: "Quiet hours on my phone",
    desc: "No push between 7 PM – 7 AM (after-hours nurse on-call still receives)",
    fallback: true,
  },
  {
    key: "daily_digest_email",
    label: "Daily digest email",
    desc: "8 AM summary of yesterday's flags and unread messages",
    fallback: true,
  },
] as const;

type Message = Database["public"]["Tables"]["messages"]["Row"];
type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-red-600",
];

function gradientFor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]!;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

// Clock time, e.g. "1:42 PM".
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Inbox-row timestamp — today shows the time, this week the weekday,
// older the date.
function listTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return clockTime(iso);
  const ageDays = (now.getTime() - d.getTime()) / 86_400_000;
  if (ageDays < 1.5) return "Yesterday";
  if (ageDays < 7) {
    return d.toLocaleDateString("en-AU", { weekday: "short" });
  }
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}

function recoveryDay(surgeryDate: string | null): number | null {
  if (!surgeryDate) return null;
  return Math.floor(
    (Date.now() - Date.parse(`${surgeryDate}T00:00:00Z`)) / 86_400_000
  );
}

function Avatar({ name, size }: { name: string; size: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs";
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white ${dim} ${gradientFor(
        name
      )}`}
    >
      {initials(name)}
    </span>
  );
}

type StaffSummary = { id: string; name: string; role: string };
type ProcSummary = {
  procedure_type: string;
  surgery_date: string | null;
  surgeon_id: string;
};
type ThreadRow = {
  id: string;
  patient_id: string;
  status: string;
  last_message_at: string | null;
  assigned_staff_id: string | null;
  patients: { first_name: string; name: string } | null;
};
type LoadedThread = {
  messages: Message[];
  attachmentsByMessage: Map<string, ReadonlyArray<MessageAttachment>>;
  lastCheckIn: { patient_zone: string; created_at: string } | null;
  templates: { id: string; label: string; body: string; category: string | null }[];
};

export default async function StaffInboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const filter = first(searchParams.filter) ?? "all";
  const selectedId = first(searchParams.thread) ?? null;
  const errorMsg = first(searchParams.error) ?? null;

  // Mark the opened thread's inbound messages read before counting unread.
  if (selectedId) {
    await supabase.rpc("mark_thread_read", { p_thread_id: selectedId });
  }

  const { data: threadRows } = await supabase
    .from("message_threads")
    .select(
      "id, patient_id, status, last_message_at, assigned_staff_id, patients(first_name, name)"
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const threads = (threadRows ?? []) as ThreadRow[];
  const threadIds = threads.map((t) => t.id);

  const emptyData = {
    lastMsg: [] as { thread_id: string; body: string; sender_type: string }[],
    unread: [] as { thread_id: string }[],
    procedures: [] as ({ patient_id: string } & ProcSummary)[],
    staff: [] as StaffSummary[],
  };

  const [lastMsgRes, unreadRes, proceduresRes, staffRes] =
    threadIds.length > 0
      ? await Promise.all([
          supabase
            .from("messages")
            .select("thread_id, body, sender_type, sent_at")
            .in("thread_id", threadIds)
            .order("sent_at", { ascending: false }),
          supabase
            .from("messages")
            .select("thread_id")
            .in("thread_id", threadIds)
            .eq("sender_type", "patient")
            .is("read_at", null),
          supabase
            .from("procedures")
            .select("patient_id, procedure_type, surgery_date, surgeon_id")
            .in(
              "patient_id",
              threads.map((t) => t.patient_id)
            )
            .eq("status", "active"),
          supabase.from("staff_users").select("id, name, role"),
        ])
      : [
          { data: emptyData.lastMsg },
          { data: emptyData.unread },
          { data: emptyData.procedures },
          { data: emptyData.staff },
        ];

  const lastByThread = new Map<
    string,
    { body: string; sender_type: string }
  >();
  for (const m of lastMsgRes.data ?? []) {
    if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
  }
  const unreadByThread = new Map<string, number>();
  for (const r of unreadRes.data ?? []) {
    unreadByThread.set(r.thread_id, (unreadByThread.get(r.thread_id) ?? 0) + 1);
  }
  const procByPatient = new Map<string, ProcSummary>(
    (proceduresRes.data ?? []).map((p) => [
      p.patient_id,
      {
        procedure_type: p.procedure_type,
        surgery_date: p.surgery_date,
        surgeon_id: p.surgeon_id,
      },
    ])
  );
  const staffById = new Map<string, StaffSummary>(
    (staffRes.data ?? []).map((s) => [s.id, s])
  );

  const unreadThreadCount = threads.filter(
    (t) => (unreadByThread.get(t.id) ?? 0) > 0
  ).length;

  const visibleThreads = threads.filter((t) => {
    if (filter === "unread") return (unreadByThread.get(t.id) ?? 0) > 0;
    if (filter === "mine") return t.assigned_staff_id === user.id;
    if (filter === "resolved") return t.status === "resolved";
    return true;
  });

  const selected = selectedId
    ? threads.find((t) => t.id === selectedId) ?? null
    : null;

  let thread: LoadedThread | null = null;
  if (selected) {
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", selected.id)
      .order("sent_at", { ascending: true });
    const msgs = (messages ?? []) as Message[];

    const allPaths = msgs.flatMap((m) => attachmentPathsFrom(m.attachments));
    const signed = await signMessageAttachments(supabase, allPaths);
    const signedByPath = new Map(signed.map((s) => [s.path, s]));
    const attachmentsByMessage = new Map<
      string,
      ReadonlyArray<MessageAttachment>
    >();
    for (const m of msgs) {
      const paths = attachmentPathsFrom(m.attachments);
      attachmentsByMessage.set(
        m.id,
        paths.map((p) => signedByPath.get(p) ?? { path: p, signed_url: null })
      );
    }

    const [{ data: lastCheckIn }, { data: templates }] = await Promise.all([
      supabase
        .from("check_ins")
        .select("patient_zone, created_at")
        .eq("patient_id", selected.patient_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("message_templates")
        .select("id, label, body, category")
        .order("label"),
    ]);

    thread = {
      messages: msgs,
      attachmentsByMessage,
      lastCheckIn: lastCheckIn ?? null,
      templates: templates ?? [],
    };
  }

  const filterParam = filter === "all" ? "" : `&filter=${filter}`;

  // The signed-in staff member's own notification preferences.
  const { data: notifPrefs } = await supabase
    .from("staff_notification_prefs")
    .select("*")
    .eq("staff_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-fv-text-primary">
              Messages
            </h1>
            <span className="rounded-full bg-[#E0F2EC] px-2.5 py-[3px] text-[11px] font-bold text-[#2E7A66]">
              Shared inbox
            </span>
          </div>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Two-way conversations with active patients · {unreadThreadCount}{" "}
            unread · Visible to all Focus Vision staff including Reception
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ComingSoonButton
            label="Templates"
            hint="The clinic message-templates editor lands in its own session. The quick-reply chips below already use the existing templates."
          />
          <ComingSoonButton
            label="New message"
            variant="primary"
            hint="Starting new threads from the staff side is coming soon. For now, a thread starts when the patient sends their first message."
          />
        </div>
      </div>

      {errorMsg ? (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      {/* Two-column layout */}
      <div className="mt-4 grid grid-cols-1 gap-4 min-[1100px]:grid-cols-[320px_1fr]">
        {/* Inbox list */}
        <section
          className={`h-[600px] min-w-0 flex-col overflow-hidden rounded-2xl border border-fv-bg-soft bg-fv-bg-card ${
            selected ? "hidden min-[1100px]:flex" : "flex"
          }`}
        >
          <header className="flex items-center justify-between border-b border-fv-bg-soft px-4 py-3.5">
            <h2 className="text-sm font-semibold text-fv-text-primary">
              Inbox
            </h2>
            <InboxFilter value={filter} threadId={selectedId} />
          </header>
          <ul className="flex-1 overflow-y-auto">
            {visibleThreads.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-fv-text-secondary">
                No threads match this filter.
              </li>
            ) : (
              visibleThreads.map((t) => {
                const name = t.patients?.name ?? "Unknown patient";
                const last = lastByThread.get(t.id);
                const unread = (unreadByThread.get(t.id) ?? 0) > 0;
                const proc = procByPatient.get(t.patient_id);
                const day = recoveryDay(proc?.surgery_date ?? null);
                const isActive = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/inbox?thread=${t.id}${filterParam}`}
                      className={`flex items-start gap-2.5 border-b border-[#F4F6F6] px-3.5 py-3 ${
                        isActive ? "bg-[#E0F2EC]" : "hover:bg-[#FAFCFC]"
                      }`}
                    >
                      <Avatar name={name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`truncate text-sm text-fv-text-primary ${
                              unread ? "font-bold" : "font-medium"
                            }`}
                          >
                            {name}
                            {day !== null ? ` · Day ${day}` : ""}
                          </span>
                          <span className="shrink-0 text-[11px] text-fv-text-secondary">
                            {listTime(t.last_message_at)}
                          </span>
                        </div>
                        <div
                          className={`mt-0.5 line-clamp-2 text-xs leading-snug ${
                            unread
                              ? "font-semibold text-fv-text-primary"
                              : "text-fv-text-secondary"
                          }`}
                        >
                          {last
                            ? `${
                                last.sender_type === "patient" ? "" : "You: "
                              }${last.body}`
                            : "No messages yet"}
                        </div>
                      </div>
                      {unread ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D04A3A]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {/* Open thread */}
        <section
          className={`h-[600px] min-w-0 flex-col overflow-hidden rounded-2xl border border-fv-bg-soft bg-fv-bg-card ${
            selected ? "flex" : "hidden min-[1100px]:flex"
          }`}
        >
          {selected && thread ? (
            <OpenThread
              selected={selected}
              thread={thread}
              staffById={staffById}
              procByPatient={procByPatient}
              filterParam={filterParam}
            />
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-fv-text-secondary">
              Select a conversation from the inbox to view it.
            </div>
          )}
        </section>
      </div>

      {/* Notification preferences */}
      <section className="mt-3.5 rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5">
        <h3 className="text-[13px] font-semibold text-fv-text-primary">
          Your notification preferences
        </h3>
        <p className="mt-0.5 text-xs text-fv-text-secondary">
          Per staff member — your teammates can set their own.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {NOTIFICATION_PREFS.map((p) => {
            const on = notifPrefs ? notifPrefs[p.key] : p.fallback;
            return (
              <li
                key={p.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-fv-bg-soft p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-fv-text-primary">
                    {p.label}
                  </div>
                  <div className="text-xs text-fv-text-secondary">
                    {p.desc}
                  </div>
                </div>
                <form action={toggleNotificationPrefAction}>
                  <input type="hidden" name="pref" value={p.key} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={(!on).toString()}
                  />
                  <button
                    type="submit"
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      on
                        ? "bg-fv-accent-strong text-white"
                        : "border border-fv-border text-fv-text-secondary"
                    }`}
                  >
                    {on ? "ON" : "OFF"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

// ─── Open thread panel ─────────────────────────────────────────────────────

const FIVE_MINUTES = 5 * 60 * 1000;

function OpenThread({
  selected,
  thread,
  staffById,
  procByPatient,
  filterParam,
}: {
  selected: ThreadRow;
  thread: LoadedThread;
  staffById: ReadonlyMap<string, StaffSummary>;
  procByPatient: ReadonlyMap<string, ProcSummary>;
  filterParam: string;
}) {
  const name = selected.patients?.name ?? "Unknown patient";
  const proc = procByPatient.get(selected.patient_id);
  const day = recoveryDay(proc?.surgery_date ?? null);
  const surgeonName = proc
    ? staffById.get(proc.surgeon_id)?.name ?? null
    : null;
  const checkIn = thread.lastCheckIn;
  const msgs = thread.messages;

  const headerLine = [
    name,
    day !== null ? `Day ${day}` : null,
    proc ? proc.procedure_type.toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const subParts: string[] = [];
  if (surgeonName) subParts.push(`Surgeon: ${surgeonName}`);
  if (checkIn) {
    const zone =
      checkIn.patient_zone.charAt(0).toUpperCase() +
      checkIn.patient_zone.slice(1);
    subParts.push(`Last check-in: ${listTime(checkIn.created_at)} (${zone} zone)`);
  }

  return (
    <>
      <ThreadRealtime
        threadId={selected.id}
        viewerType="staff"
        notificationTitle={`New message from ${name}`}
      />

      {/* Header bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-fv-bg-soft px-4 py-3">
        <Link
          href={filterParam ? `/inbox?${filterParam.slice(1)}` : "/inbox"}
          className="text-fv-text-secondary min-[1100px]:hidden"
          aria-label="Back to inbox"
        >
          ←
        </Link>
        <Avatar name={name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-fv-text-primary">
            {headerLine}
          </div>
          {subParts.length > 0 ? (
            <div className="truncate text-[11px] text-fv-text-secondary">
              {subParts.join(" · ")}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/patients/${selected.patient_id}`}
            className="rounded-md border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
          >
            Open patient
          </Link>
          {selected.status === "resolved" ? (
            <span className="rounded-md bg-fv-bg-soft px-3 py-1.5 text-xs font-semibold text-fv-text-secondary">
              Resolved
            </span>
          ) : (
            <form action={resolveThreadAction}>
              <input type="hidden" name="thread_id" value={selected.id} />
              <button
                type="submit"
                className="rounded-md border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
              >
                Resolve
              </button>
            </form>
          )}
        </div>
      </header>

      {/* Message body */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 ? (
          <p className="py-10 text-center text-sm text-fv-text-secondary">
            No messages yet.
          </p>
        ) : (
          msgs.map((m, i) => {
            const isStaff = m.sender_type === "staff";
            const prev = i > 0 ? msgs[i - 1]! : null;
            const isLast = i === msgs.length - 1;
            const awaitingReply = isLast && m.sender_type === "patient";
            const sender = isStaff ? staffById.get(m.sender_id) : null;

            // A staff reply chained onto a different colleague's recent
            // reply — shared-inbox hand-off.
            const chainedTo =
              isStaff &&
              prev &&
              prev.sender_type === "staff" &&
              prev.sender_id !== m.sender_id &&
              Date.parse(m.sent_at) - Date.parse(prev.sent_at) < FIVE_MINUTES
                ? staffById.get(prev.sender_id)?.name ?? null
                : null;

            const metaName = isStaff
              ? sender
                ? `${sender.name} (${sender.role})`
                : "Focus Vision team"
              : firstName(name);
            const meta = [
              `${metaName} · ${clockTime(m.sent_at)}`,
              chainedTo ? `added to ${firstName(chainedTo)}'s reply` : null,
              awaitingReply ? "awaiting reply" : null,
            ]
              .filter(Boolean)
              .join(" · ");

            const attachments = thread.attachmentsByMessage.get(m.id) ?? [];

            return (
              <div
                key={m.id}
                className={`flex flex-col ${
                  isStaff ? "items-end" : "items-start"
                }`}
              >
                <div className="mb-1 px-1 text-[10px] text-fv-text-secondary">
                  {meta}
                </div>
                <div
                  className={`max-w-[75%] rounded-[18px] px-3.5 py-2.5 text-sm leading-relaxed ${
                    isStaff
                      ? "rounded-br-[5px] bg-fv-accent-strong text-white"
                      : `rounded-bl-[5px] bg-fv-bg-soft text-fv-text-primary ${
                          awaitingReply
                            ? "border-l-[3px] border-l-[#D67E3B]"
                            : ""
                        }`
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  {attachments.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attachments.map((a) =>
                        a.signed_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a
                            key={a.path}
                            href={a.signed_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={a.signed_url}
                              alt="attachment"
                              className="max-h-44 rounded-md"
                            />
                          </a>
                        ) : (
                          <span
                            key={a.path}
                            className="text-xs italic opacity-75"
                          >
                            (attachment unavailable)
                          </span>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick-reply chips + compose */}
      <StaffComposer threadId={selected.id} templates={thread.templates} />
    </>
  );
}

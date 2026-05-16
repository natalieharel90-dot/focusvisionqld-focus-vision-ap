import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";

export const dynamic = "force-dynamic";

const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-teal-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-600",
  "bg-sky-600",
  "bg-orange-500",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function relTime(iso: string): string {
  const day = new Date(iso).toLocaleDateString("en-CA");
  const today = new Date().toLocaleDateString("en-CA");
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString(
    "en-CA"
  );
  if (day === today) {
    return new Date(iso)
      .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
      .toUpperCase();
  }
  if (day === yesterday) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor(
    (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000
  );
}

const ZONE_TEXT: Record<string, { label: string; cls: string }> = {
  green: { label: "Green", cls: "text-emerald-700" },
  yellow: { label: "Yellow", cls: "text-amber-700" },
  orange: { label: "Orange", cls: "text-orange-700" },
};

export default async function StaffAppMessages() {
  const supabase = createSupabaseServerClient();

  const { data: threadRows } = await supabase
    .from("message_threads")
    .select("id, patient_id, last_message_at, unread_for_staff")
    .order("last_message_at", { ascending: false });
  const threads = threadRows ?? [];
  const threadIds = threads.map((t) => t.id);

  const [messagesRes, patientsRes, proceduresRes, checkInsRes] =
    await Promise.all([
      threadIds.length > 0
        ? supabase
            .from("messages")
            .select("thread_id, body, sender_type, sent_at")
            .in("thread_id", threadIds)
            .order("sent_at", { ascending: false })
        : Promise.resolve({ data: [] as Array<{ thread_id: string; body: string; sender_type: string; sent_at: string }> }),
      supabase.from("patients").select("id, name"),
      supabase
        .from("procedures")
        .select("patient_id, procedure_type, surgery_date")
        .eq("status", "active"),
      supabase
        .from("check_ins")
        .select("patient_id, patient_zone, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const lastByThread = new Map<string, { body: string }>();
  for (const m of messagesRes.data ?? []) {
    if (!lastByThread.has(m.thread_id))
      lastByThread.set(m.thread_id, { body: m.body });
  }
  const patientName = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, p.name])
  );
  const procByPatient = new Map(
    (proceduresRes.data ?? []).map((p) => [p.patient_id, p])
  );
  const zoneByPatient = new Map<string, string>();
  for (const c of checkInsRes.data ?? []) {
    if (!zoneByPatient.has(c.patient_id))
      zoneByPatient.set(c.patient_id, c.patient_zone ?? "green");
  }

  return (
    <ul className="flex flex-col divide-y divide-fv-bg-soft">
      {threads.length === 0 ? (
        <li className="px-4 py-6 text-center text-sm text-fv-text-secondary">
          No conversations yet.
        </li>
      ) : (
        threads.map((t) => {
          const name = patientName.get(t.patient_id) ?? "Unknown";
          const proc = procByPatient.get(t.patient_id);
          const day = daysSince(proc?.surgery_date ?? null);
          const zone =
            ZONE_TEXT[zoneByPatient.get(t.patient_id) ?? "green"] ??
            ZONE_TEXT.green!;
          const unread = (t.unread_for_staff ?? 0) > 0;
          return (
            <li key={t.id}>
              <Link
                href={`/inbox?thread=${t.id}`}
                className="flex gap-3 px-4 py-3.5"
              >
                <div className="relative shrink-0">
                  {unread ? (
                    <span className="absolute -left-1 top-4 h-2 w-2 rounded-full bg-red-600" />
                  ) : null}
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-full text-xs font-semibold text-white ${avatarColor(
                      name
                    )}`}
                  >
                    {initials(name)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-fv-text-primary">
                      {name}
                    </span>
                    {t.last_message_at ? (
                      <span className="shrink-0 text-xs text-fv-text-secondary">
                        {relTime(t.last_message_at)}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-0.5 line-clamp-2 text-sm ${
                      unread
                        ? "font-semibold text-fv-text-primary"
                        : "text-fv-text-secondary"
                    }`}
                  >
                    {lastByThread.get(t.id)?.body ?? "No messages yet."}
                  </p>
                  <div className="mt-1 text-xs text-fv-text-secondary">
                    {day != null ? `Day ${day} · ` : ""}
                    {proc?.procedure_type?.toUpperCase() ?? ""}
                    {" · "}
                    <span className={`font-semibold ${zone.cls}`}>
                      {zone.label}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })
      )}
    </ul>
  );
}

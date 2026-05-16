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
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor(
    (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000
  );
}

type TriageItem = {
  patientId: string;
  name: string;
  tier: "orange" | "yellow";
  rank: number;
  day: number | null;
  procedure: string;
  when: string;
  detail: string;
  threadId: string | null;
  phone: string | null;
};

export default async function StaffAppTriage() {
  const supabase = createSupabaseServerClient();

  const [checkInsRes, flagsRes, patientsRes, proceduresRes, threadsRes] =
    await Promise.all([
      supabase
        .from("check_ins")
        .select(
          "patient_id, staff_alert_level, pain, vision, light_sensitivity, recovery_day, created_at"
        )
        .neq("staff_alert_level", "none")
        .order("created_at", { ascending: false }),
      supabase
        .from("manual_flags")
        .select("patient_id, alert_level, reason, created_at")
        .is("resolved_at", null),
      supabase.from("patients").select("id, name, phone"),
      supabase
        .from("procedures")
        .select("patient_id, procedure_type, surgery_date")
        .eq("status", "active"),
      supabase.from("message_threads").select("id, patient_id"),
    ]);

  const patientById = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, p])
  );
  const procByPatient = new Map(
    (proceduresRes.data ?? []).map((p) => [p.patient_id, p])
  );
  const threadByPatient = new Map(
    (threadsRes.data ?? []).map((t) => [t.patient_id, t.id])
  );

  const RANK: Record<string, number> = { red: 3, orange: 2, yellow: 1 };
  // One item per patient — the most severe live signal.
  const byPatient = new Map<string, TriageItem>();

  function consider(item: TriageItem) {
    const existing = byPatient.get(item.patientId);
    if (!existing || item.rank > existing.rank) byPatient.set(item.patientId, item);
  }

  const seenCheckIn = new Set<string>();
  for (const c of checkInsRes.data ?? []) {
    if (seenCheckIn.has(c.patient_id)) continue;
    seenCheckIn.add(c.patient_id);
    const p = patientById.get(c.patient_id);
    if (!p) continue;
    const level = c.staff_alert_level;
    const proc = procByPatient.get(c.patient_id);
    consider({
      patientId: c.patient_id,
      name: p.name,
      tier: level === "yellow" ? "yellow" : "orange",
      rank: RANK[level] ?? 1,
      day: c.recovery_day ?? daysSince(proc?.surgery_date ?? null),
      procedure: proc?.procedure_type?.toUpperCase() ?? "",
      when: relTime(c.created_at),
      detail: `Pain ${c.pain}/5 · Vision "${c.vision}" · light ${c.light_sensitivity}/5`,
      threadId: threadByPatient.get(c.patient_id) ?? null,
      phone: p.phone,
    });
  }
  for (const f of flagsRes.data ?? []) {
    const p = patientById.get(f.patient_id);
    if (!p) continue;
    const proc = procByPatient.get(f.patient_id);
    consider({
      patientId: f.patient_id,
      name: p.name,
      tier: f.alert_level === "yellow" ? "yellow" : "orange",
      rank: RANK[f.alert_level] ?? 1,
      day: daysSince(proc?.surgery_date ?? null),
      procedure: proc?.procedure_type?.toUpperCase() ?? "",
      when: relTime(f.created_at),
      detail: f.reason ?? "Manually flagged for review",
      threadId: threadByPatient.get(f.patient_id) ?? null,
      phone: p.phone,
    });
  }

  const items = [...byPatient.values()];
  const orange = items.filter((i) => i.tier === "orange");
  const yellow = items.filter((i) => i.tier === "yellow");

  return (
    <div className="px-4 py-4">
      {items.length === 0 ? (
        <p className="text-sm text-fv-text-secondary">
          Nothing in the triage queue — all clear.
        </p>
      ) : null}

      {orange.length > 0 ? (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
            Orange · contact today
          </div>
          <div className="mt-2 flex flex-col gap-3">
            {orange.map((i) => (
              <TriageCard key={i.patientId} item={i} accent="#D67E3B" />
            ))}
          </div>
        </>
      ) : null}

      {yellow.length > 0 ? (
        <>
          <div className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
            Yellow · review within 4h
          </div>
          <div className="mt-2 flex flex-col gap-3">
            {yellow.map((i) => (
              <TriageCard key={i.patientId} item={i} accent="#D8A82A" />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TriageCard({ item, accent }: { item: TriageItem; accent: string }) {
  return (
    <div
      className="rounded-xl border-l-4 bg-fv-bg-card p-3 shadow-sm"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${avatarColor(
            item.name
          )}`}
        >
          {initials(item.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-semibold text-fv-text-primary">
            {item.name}
          </div>
          <div className="text-xs text-fv-text-secondary">
            {item.day != null ? `Day ${item.day} · ` : ""}
            {item.procedure} · {item.when}
          </div>
        </div>
      </div>
      <p className="mt-2 rounded-lg bg-fv-bg-soft/60 px-3 py-2 text-xs text-fv-text-primary">
        {item.detail}
      </p>
      <div className="mt-2 flex gap-2">
        {item.phone ? (
          <a
            href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
            className="flex-1 rounded-md border border-fv-border py-1.5 text-center text-xs font-semibold text-fv-text-primary"
          >
            📞 Call
          </a>
        ) : null}
        {item.threadId ? (
          <Link
            href={`/inbox?thread=${item.threadId}`}
            className="flex-1 rounded-md border border-fv-border py-1.5 text-center text-xs font-semibold text-fv-text-primary"
          >
            💬 Reply
          </Link>
        ) : null}
        <Link
          href={`/patients/${item.patientId}`}
          className="flex-1 rounded-md bg-fv-accent-strong py-1.5 text-center text-xs font-semibold text-white"
        >
          Open
        </Link>
      </div>
    </div>
  );
}

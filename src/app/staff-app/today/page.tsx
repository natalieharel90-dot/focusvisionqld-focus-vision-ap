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
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  if (hrs < 48) return "Yesterday";
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

const ZONE_PILL: Record<string, { label: string; cls: string }> = {
  green: { label: "Green", cls: "bg-emerald-100 text-emerald-800" },
  yellow: { label: "Yellow", cls: "bg-amber-100 text-amber-800" },
  orange: { label: "Orange", cls: "bg-orange-100 text-orange-800" },
};

const Section = ({ label }: { label: string }) => (
  <div className="mt-5 px-4 text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
    {label}
  </div>
);

export default async function StaffAppToday() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user?.id ?? "";

  const [threadsRes, apptsRes, flagsRes, patientsRes, proceduresRes] =
    await Promise.all([
      supabase
        .from("message_threads")
        .select("id, patient_id, last_message_at, unread_for_staff")
        .eq("assigned_staff_id", me),
      supabase
        .from("appointments")
        .select(
          "id, appointment_type, scheduled_at, location, patient_id, status"
        )
        .eq("clinician_id", me),
      supabase.from("manual_flags").select("patient_id").is("resolved_at", null),
      supabase.from("patients").select("id, name, discharged_at"),
      supabase
        .from("procedures")
        .select("patient_id, procedure_type, surgery_date")
        .eq("status", "active"),
    ]);

  const myThreads = threadsRes.data ?? [];
  const patientName = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, p.name])
  );
  const procByPatient = new Map(
    (proceduresRes.data ?? []).map((p) => [p.patient_id, p])
  );
  const flaggedSet = new Set((flagsRes.data ?? []).map((f) => f.patient_id));

  const today = new Date().toLocaleDateString("en-CA");
  const myApptsToday = (apptsRes.data ?? []).filter(
    (a) =>
      a.scheduled_at &&
      new Date(a.scheduled_at).toLocaleDateString("en-CA") === today
  );

  // Threads assigned to me with an unread patient message — awaiting reply.
  const awaiting = myThreads.filter((t) => (t.unread_for_staff ?? 0) > 0);

  function dayLabel(patientId: string): string {
    const proc = procByPatient.get(patientId);
    const d = daysSince(proc?.surgery_date ?? null);
    const type = proc?.procedure_type?.toUpperCase() ?? "";
    return d != null ? `Day ${d} ${type}` : type;
  }

  return (
    <div>
      {/* Shift card */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 rounded-xl bg-fv-bg-accent-soft p-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <div>
            <div className="text-sm font-semibold text-fv-text-primary">
              You&apos;re on shift
            </div>
            <div className="text-xs text-fv-text-secondary">
              Push notifications on — manage them in Me
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-3 grid grid-cols-3 gap-2 px-4">
        {[
          { n: myThreads.length, label: "My threads" },
          { n: myApptsToday.length, label: "My appts" },
          { n: flaggedSet.size, label: "Flagged" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-fv-bg-soft bg-fv-bg-card px-3 py-3 text-center"
          >
            <div className="text-2xl font-bold text-fv-text-primary">
              {s.n}
            </div>
            <div className="text-xs text-fv-text-secondary">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Awaiting your reply */}
      <Section label="Awaiting your reply" />
      <div className="mt-2 flex flex-col gap-2 px-4">
        {awaiting.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">
            Nothing awaiting your reply.
          </p>
        ) : (
          awaiting.map((t) => (
            <Link
              key={t.id}
              href={`/inbox?thread=${t.id}`}
              className="rounded-xl border-l-4 border-fv-accent-strong bg-fv-bg-card p-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${avatarColor(
                    patientName.get(t.patient_id) ?? "?"
                  )}`}
                >
                  {initials(patientName.get(t.patient_id) ?? "?")}
                </span>
                <span className="flex-1 truncate text-sm font-semibold text-fv-text-primary">
                  {patientName.get(t.patient_id) ?? "Unknown"}
                </span>
                {t.last_message_at ? (
                  <span className="shrink-0 text-xs text-fv-text-secondary">
                    {relTime(t.last_message_at)}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-fv-text-secondary">
                {dayLabel(t.patient_id)} · assigned to you
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Appointments today */}
      <Section label="Your appointments today" />
      <div className="mt-2 flex flex-col gap-2 px-4">
        {myApptsToday.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">
            No appointments today.
          </p>
        ) : (
          myApptsToday.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-fv-bg-soft bg-fv-bg-card p-3"
            >
              <div className="w-16 shrink-0 text-sm font-semibold text-fv-text-primary">
                {a.scheduled_at
                  ? new Date(a.scheduled_at).toLocaleTimeString("en-AU", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-fv-text-primary">
                  {patientName.get(a.patient_id) ?? "Unknown"} ·{" "}
                  {a.appointment_type}
                </div>
                <div className="text-xs text-fv-text-secondary">
                  {a.location ? a.location.replace("_", " ") : "—"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Patients I'm monitoring */}
      <Section label="Patients I'm monitoring" />
      <div className="mb-4 mt-2 flex flex-col gap-2 px-4">
        {myThreads.length === 0 ? (
          <p className="text-sm text-fv-text-secondary">
            No patients assigned to you.
          </p>
        ) : (
          myThreads.map((t) => {
            const name = patientName.get(t.patient_id) ?? "Unknown";
            const flagged = flaggedSet.has(t.patient_id);
            return (
              <Link
                key={t.id}
                href={`/patients/${t.patient_id}`}
                className="flex items-center gap-3 rounded-xl border border-fv-bg-soft bg-fv-bg-card p-3"
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${avatarColor(
                    name
                  )}`}
                >
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-fv-text-primary">
                    {name}
                  </div>
                  <div className="text-xs text-fv-text-secondary">
                    {dayLabel(t.patient_id)}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    flagged
                      ? ZONE_PILL.orange!.cls
                      : ZONE_PILL.green!.cls
                  }`}
                >
                  {flagged ? "Flagged" : "On track"}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

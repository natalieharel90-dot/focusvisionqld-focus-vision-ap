import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ADHERENCE_FLOOR = 85; // below this, a patient reads as "missed doses"
const PAIN_FLAG = 4; // pain at/above this surfaces as a flagged status

function brisbaneDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
}

function recoveryDay(surgeryDate: string | null): number | null {
  if (!surgeryDate) return null;
  return Math.floor(
    (Date.now() - new Date(`${surgeryDate}T00:00:00Z`).getTime()) / 86_400_000
  );
}

// "Today, 9:12 am" / "Yesterday" / "3 May" / "Pending".
function formatLastCheckIn(iso: string | null): string {
  if (!iso) return "Pending";
  const today = brisbaneDate(new Date());
  const yesterday = brisbaneDate(new Date(Date.now() - 86_400_000));
  const day = brisbaneDate(new Date(iso));
  if (day === today) {
    const time = new Date(iso)
      .toLocaleTimeString("en-AU", {
        timeZone: "Australia/Brisbane",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase()
      .replace(" ", "");
    return `Today, ${time}`;
  }
  if (day === yesterday) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric",
    month: "short",
  });
}

const AVATAR_COLORS = [
  "#2E7A66",
  "#3B82B5",
  "#C6873B",
  "#C0654D",
  "#7E4DAB",
  "#4FA38A",
];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] as string;
}

type Tone = "good" | "review" | "flag";
const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-100 text-emerald-800",
  review: "bg-amber-100 text-amber-800",
  flag: "bg-red-100 text-red-700",
};

export default async function PatientsListPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createSupabaseServerClient();
  const query = (searchParams.q ?? "").trim();
  const sevenDaysAgo = new Date(Date.now() - WEEK_MS).toISOString();

  const [
    patientsResult,
    proceduresResult,
    checkInsResult,
    flagsResult,
    medsResult,
    dosesResult,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id, name, email, created_at")
      .order("name"),
    supabase
      .from("procedures")
      .select("patient_id, procedure_type, eye, surgery_date")
      .eq("status", "active"),
    supabase
      .from("check_ins")
      .select("patient_id, pain, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("manual_flags").select("patient_id").is("resolved_at", null),
    supabase.from("medications").select("id, patient_id"),
    supabase
      .from("medication_doses")
      .select("medication_id, taken_at")
      .gte("scheduled_at", sevenDaysAgo),
  ]);

  const patients = patientsResult.data ?? [];
  const procedures = proceduresResult.data ?? [];
  const checkIns = checkInsResult.data ?? [];
  const flags = flagsResult.data ?? [];
  const meds = medsResult.data ?? [];
  const doses = dosesResult.data ?? [];

  const procByPatient = new Map(procedures.map((p) => [p.patient_id, p]));

  // Latest check-in per patient (rows arrive newest-first).
  const latestCheckIn = new Map<string, (typeof checkIns)[number]>();
  for (const c of checkIns) {
    if (!latestCheckIn.has(c.patient_id)) latestCheckIn.set(c.patient_id, c);
  }

  const flaggedPatients = new Set(flags.map((f) => f.patient_id));

  // Adherence — taken vs scheduled doses (last 7 days), per patient.
  const patientByMed = new Map(meds.map((m) => [m.id, m.patient_id]));
  const doseTally = new Map<string, { scheduled: number; taken: number }>();
  for (const d of doses) {
    const patientId = patientByMed.get(d.medication_id);
    if (!patientId) continue;
    const t = doseTally.get(patientId) ?? { scheduled: 0, taken: 0 };
    t.scheduled += 1;
    if (d.taken_at) t.taken += 1;
    doseTally.set(patientId, t);
  }
  const adherencePct = (patientId: string): number | null => {
    const t = doseTally.get(patientId);
    if (!t || t.scheduled === 0) return null;
    return Math.round((t.taken / t.scheduled) * 100);
  };

  const today = brisbaneDate(new Date());

  // ── KPIs ──
  const activeCount = procByPatient.size;
  const newThisWeek = patients.filter(
    (p) => Date.now() - new Date(p.created_at).getTime() < WEEK_MS
  ).length;
  const pendingCheckIns = [...procByPatient.keys()].filter((id) => {
    const c = latestCheckIn.get(id);
    return !c || brisbaneDate(new Date(c.created_at)) !== today;
  }).length;
  const flaggedCount = flaggedPatients.size;
  const clinicDoses = doses.length;
  const clinicTaken = doses.filter((d) => d.taken_at).length;
  const clinicAdherence =
    clinicDoses > 0 ? Math.round((clinicTaken / clinicDoses) * 100) : null;

  // ── Rows (search-filtered) ──
  const rows = patients
    .filter((p) => {
      if (!query) return true;
      const proc = procByPatient.get(p.id);
      const haystack = `${p.name} ${p.email ?? ""} ${
        proc?.procedure_type ?? ""
      }`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    })
    .map((p) => {
      const proc = procByPatient.get(p.id);
      const latest = latestCheckIn.get(p.id) ?? null;
      const adh = adherencePct(p.id);
      const checkedInToday =
        latest != null && brisbaneDate(new Date(latest.created_at)) === today;

      let status: { label: string; tone: Tone };
      if (latest && latest.pain >= PAIN_FLAG) {
        status = { label: `Pain reported (${latest.pain}/5)`, tone: "flag" };
      } else if (flaggedPatients.has(p.id)) {
        status = { label: "Flagged for review", tone: "flag" };
      } else if (adh !== null && adh < ADHERENCE_FLOOR) {
        status = { label: "Missed doses", tone: "review" };
      } else if (!checkedInToday) {
        status = { label: "Awaiting check-in", tone: "review" };
      } else {
        status = { label: "On track", tone: "good" };
      }

      return { patient: p, proc, latest, adh, status };
    });

  return (
    <main className="mx-auto max-w-6xl px-8 py-7">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fv-text-primary">
            Patients
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            {activeCount} active · {newThisWeek} new this week
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form method="get">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search name, email or procedure…"
              className="w-72 rounded-xl border border-fv-border bg-fv-bg-card px-4 py-2.5 text-sm"
            />
          </form>
          <Link
            href="/patients/new"
            className="rounded-xl bg-fv-accent-strong px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add patient
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Active recoveries"
          value={activeCount}
          sub={`↑ ${newThisWeek} this week`}
        />
        <KpiCard label="Pending check-ins" value={pendingCheckIns} sub="Today" />
        <KpiCard
          label="Flagged for review"
          value={flaggedCount}
          sub={flaggedCount > 0 ? "Needs attention" : "All clear"}
          alert={flaggedCount > 0}
        />
        <KpiCard
          label="Adherence (7d)"
          value={clinicAdherence === null ? "—" : `${clinicAdherence}%`}
          sub="Doses taken on time"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-fv-bg-soft bg-fv-bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-fv-bg-soft text-[11px] uppercase tracking-wider text-fv-text-secondary">
              <th className="px-4 py-3 font-bold">Patient</th>
              <th className="px-4 py-3 font-bold">Procedure</th>
              <th className="px-4 py-3 font-bold">Day</th>
              <th className="px-4 py-3 font-bold">Last check-in</th>
              <th className="px-4 py-3 font-bold">Adherence</th>
              <th className="px-4 py-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-fv-text-secondary"
                >
                  {query
                    ? "No patients match your search."
                    : "No patients found."}
                </td>
              </tr>
            ) : (
              rows.map(({ patient, proc, latest, adh, status }) => {
                const day = recoveryDay(proc?.surgery_date ?? null);
                return (
                  <tr
                    key={patient.id}
                    className="border-b border-fv-bg-soft last:border-0 hover:bg-fv-bg-soft/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="flex items-center gap-3"
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: avatarColor(patient.id) }}
                        >
                          {initials(patient.name)}
                        </span>
                        <span className="font-semibold text-fv-text-primary">
                          {patient.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-fv-text-secondary">
                      {proc
                        ? `${proc.procedure_type.toUpperCase()} · ${proc.eye} ${
                            proc.eye === "both" ? "eyes" : "eye"
                          }`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-fv-text-secondary">
                      {day === null ? "—" : `Day ${day}`}
                    </td>
                    <td className="px-4 py-3 text-fv-text-secondary">
                      {formatLastCheckIn(latest?.created_at ?? null)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-fv-text-secondary">
                      {adh === null ? "—" : `${adh}%`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          TONE_CLASS[status.tone]
                        }`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  sub,
  alert = false,
}: {
  label: string;
  value: number | string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fv-text-secondary">
        {label}
      </div>
      <div
        className={`mt-1.5 text-2xl font-bold tracking-tight ${
          alert ? "text-red-600" : "text-fv-text-primary"
        }`}
      >
        {value}
      </div>
      <div
        className={`mt-0.5 text-[11px] ${
          alert ? "text-red-600" : "text-fv-text-secondary"
        }`}
      >
        {sub}
      </div>
    </div>
  );
}

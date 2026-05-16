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

const ZONE_PILL: Record<string, { label: string; cls: string }> = {
  green: { label: "On track", cls: "bg-emerald-100 text-emerald-800" },
  yellow: { label: "Yellow", cls: "bg-amber-100 text-amber-800" },
  orange: { label: "Orange", cls: "bg-orange-100 text-orange-800" },
};

function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor(
    (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000
  );
}

export default async function StaffAppPatients({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createSupabaseServerClient();
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const [patientsRes, proceduresRes, checkInsRes, staffRes] =
    await Promise.all([
      supabase.from("patients").select("id, name, discharged_at"),
      supabase
        .from("procedures")
        .select("patient_id, procedure_type, surgery_date, surgeon_id")
        .eq("status", "active"),
      supabase
        .from("check_ins")
        .select("patient_id, patient_zone, recovery_day, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("staff_users").select("id, name, display_name"),
    ]);

  const procByPatient = new Map(
    (proceduresRes.data ?? []).map((p) => [p.patient_id, p])
  );
  const latestZone = new Map<string, { zone: string; day: number | null }>();
  for (const c of checkInsRes.data ?? []) {
    if (!latestZone.has(c.patient_id)) {
      latestZone.set(c.patient_id, {
        zone: c.patient_zone ?? "green",
        day: c.recovery_day,
      });
    }
  }
  const staffName = new Map(
    (staffRes.data ?? []).map((s) => [s.id, s.display_name || s.name])
  );

  const rows = (patientsRes.data ?? [])
    .filter((p) => p.discharged_at == null && procByPatient.has(p.id))
    .map((p) => {
      const proc = procByPatient.get(p.id)!;
      const ci = latestZone.get(p.id);
      const day = ci?.day ?? daysSince(proc.surgery_date) ?? 0;
      return {
        id: p.id,
        name: p.name,
        day,
        procedure: proc.procedure_type.toUpperCase(),
        surgeon: staffName.get(proc.surgeon_id) ?? "—",
        zone: ci?.zone ?? "green",
      };
    })
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="px-4 py-4">
      <form>
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search patients…"
          className="w-full rounded-xl border border-fv-bg-soft bg-fv-bg-card px-4 py-3 text-sm focus:border-fv-accent focus:outline-none"
        />
      </form>
      <p className="mt-3 text-sm text-fv-text-secondary">
        {rows.length} active recover{rows.length === 1 ? "y" : "ies"}
      </p>

      <ul className="mt-2 flex flex-col divide-y divide-fv-bg-soft">
        {rows.map((r) => {
          const pill = ZONE_PILL[r.zone] ?? ZONE_PILL.green!;
          return (
            <li key={r.id}>
              <Link
                href={`/patients/${r.id}`}
                className="flex items-center gap-3 py-3"
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${avatarColor(
                    r.name
                  )}`}
                >
                  {initials(r.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-fv-text-primary">
                    {r.name}
                  </div>
                  <div className="text-xs text-fv-text-secondary">
                    Day {r.day} · {r.procedure} · {r.surgeon}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pill.cls}`}
                >
                  {pill.label}
                </span>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="py-6 text-center text-sm text-fv-text-secondary">
            No patients found.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

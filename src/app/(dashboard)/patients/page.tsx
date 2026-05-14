import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Whole days between surgery_date (a Postgres DATE, midnight UTC) and now.
function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const surgery = new Date(`${dateStr}T00:00:00Z`).getTime();
  const diffMs = Date.now() - surgery;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function zoneClasses(zone: string | null): string {
  switch (zone) {
    case "green":
      return "bg-green-100 text-green-800";
    case "yellow":
      return "bg-yellow-100 text-yellow-800";
    case "orange":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-fv-bg-soft text-fv-text-secondary";
  }
}

export default async function PatientsListPage() {
  const supabase = createSupabaseServerClient();

  // Three small queries joined in memory. Cleaner types than a deep embed,
  // and at clinic scale (hundreds of active patients) this is well under a
  // single round-trip's worth of network time.
  const [patientsResult, proceduresResult, checkInsResult] = await Promise.all([
    supabase.from("patients").select("id, name").order("name"),
    supabase
      .from("procedures")
      .select("patient_id, procedure_type, eye, surgery_date, surgeon_id")
      .eq("status", "active"),
    supabase
      .from("check_ins")
      .select("patient_id, recovery_day, patient_zone, staff_alert_level"),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (proceduresResult.error) throw proceduresResult.error;
  if (checkInsResult.error) throw checkInsResult.error;

  const patients = patientsResult.data ?? [];
  const procedures = proceduresResult.data ?? [];
  const checkIns = checkInsResult.data ?? [];

  const surgeonIds = Array.from(
    new Set(procedures.map((p) => p.surgeon_id).filter(Boolean))
  );

  const surgeonsResult =
    surgeonIds.length > 0
      ? await supabase
          .from("staff_users")
          .select("id, name")
          .in("id", surgeonIds)
      : { data: [], error: null };
  if (surgeonsResult.error) throw surgeonsResult.error;

  const surgeonById = new Map(
    (surgeonsResult.data ?? []).map((s) => [s.id, s.name])
  );
  const procByPatient = new Map(procedures.map((p) => [p.patient_id, p]));
  const latestCheckInByPatient = new Map<
    string,
    (typeof checkIns)[number]
  >();
  for (const c of checkIns) {
    const existing = latestCheckInByPatient.get(c.patient_id);
    if (!existing || c.recovery_day > existing.recovery_day) {
      latestCheckInByPatient.set(c.patient_id, c);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between pb-6">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Patients
        </h1>
        <span className="text-sm text-fv-text-secondary">
          {patients.length} total
        </span>
      </div>

      <div className="overflow-hidden rounded-xl bg-fv-bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-fv-bg-soft text-xs uppercase tracking-wide text-fv-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Procedure</th>
              <th className="px-4 py-3 font-semibold">Surgeon</th>
              <th className="px-4 py-3 font-semibold">Recovery day</th>
              <th className="px-4 py-3 font-semibold">Latest zone</th>
              <th className="px-4 py-3 font-semibold">Alert</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const proc = procByPatient.get(p.id);
              const surgeon = proc ? surgeonById.get(proc.surgeon_id) : null;
              const recoveryDay = daysSince(proc?.surgery_date ?? null);
              const latest = latestCheckInByPatient.get(p.id);
              return (
                <tr
                  key={p.id}
                  className="border-t border-fv-bg-soft text-fv-text-primary"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/patients/${p.id}`}
                      className="text-fv-accent-strong hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {proc
                      ? `${proc.procedure_type.toUpperCase()} · ${proc.eye}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{surgeon ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {recoveryDay === null ? "—" : `Day ${recoveryDay}`}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${zoneClasses(
                        latest?.patient_zone ?? null
                      )}`}
                    >
                      {latest?.patient_zone ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {latest?.staff_alert_level &&
                    latest.staff_alert_level !== "none"
                      ? latest.staff_alert_level
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {patients.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-fv-text-secondary"
                >
                  No patients found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-sm">
        <Link href="/" className="text-fv-accent-strong hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    </main>
  );
}

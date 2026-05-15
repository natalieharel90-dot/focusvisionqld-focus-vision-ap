import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FEATURE_BY_KEY } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ManageOverridesPage({
  params,
}: {
  params: { feature: string };
}) {
  const meta = FEATURE_BY_KEY.get(params.feature);
  if (!meta) notFound();

  const supabase = createSupabaseServerClient();
  const { data: flagRows } = await supabase
    .from("patient_feature_flags")
    .select("patient_id, enabled, changed_at, changed_by_staff_id")
    .eq("feature_key", params.feature)
    .not("changed_by_staff_id", "is", null)
    .order("changed_at", { ascending: false });

  const rows = flagRows ?? [];
  const patientIds = [...new Set(rows.map((r) => r.patient_id))];
  const staffIds = [
    ...new Set(
      rows
        .map((r) => r.changed_by_staff_id)
        .filter((id): id is string => id !== null)
    ),
  ];

  const [patientsRes, staffRes] = await Promise.all([
    patientIds.length
      ? supabase.from("patients").select("id, name").in("id", patientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    staffIds.length
      ? supabase.from("staff_users").select("id, name").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const patientName = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, p.name])
  );
  const staffName = new Map((staffRes.data ?? []).map((s) => [s.id, s.name]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/settings/patient-features"
        className="text-xs font-semibold text-fv-text-secondary hover:underline"
      >
        ← Patient app features
      </Link>
      <h1 className="mb-1 mt-1 text-2xl font-semibold text-fv-text-primary">
        {meta.label} — overrides
      </h1>
      <p className="mb-5 text-sm text-fv-text-secondary">
        Patients whose state for this feature was explicitly set by staff,
        rather than inherited from the default at activation. Open a patient to
        change their override.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No explicit overrides for this feature.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.patient_id}
              className="flex items-center justify-between rounded-xl bg-fv-bg-card p-4 shadow-sm"
            >
              <div>
                <Link
                  href={`/patients/${r.patient_id}`}
                  className="text-sm font-medium text-fv-accent-strong hover:underline"
                >
                  {patientName.get(r.patient_id) ?? "Unknown patient"}
                </Link>
                <div className="text-xs text-fv-text-secondary">
                  Set by{" "}
                  {r.changed_by_staff_id
                    ? (staffName.get(r.changed_by_staff_id) ?? "—")
                    : "—"}{" "}
                  · {fmt(r.changed_at)}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  r.enabled
                    ? "bg-fv-accent-strong text-white"
                    : "border border-fv-border text-fv-text-secondary"
                }`}
              >
                {r.enabled ? "ON" : "OFF"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

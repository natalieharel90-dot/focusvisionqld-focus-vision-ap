import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FEATURES, NUDGE_TIMES } from "@/lib/feature-flags";
import { updateFeatureDefaultAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PatientFeaturesSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();

  const [{ data: defaults }, { data: overrideRows }] = await Promise.all([
    supabase.from("feature_defaults").select("*"),
    supabase
      .from("patient_feature_flags")
      .select("feature_key, changed_by_staff_id")
      .not("changed_by_staff_id", "is", null),
  ]);

  const defaultByKey = new Map((defaults ?? []).map((d) => [d.feature_key, d]));
  const overrideCount = new Map<string, number>();
  for (const row of overrideRows ?? []) {
    overrideCount.set(
      row.feature_key,
      (overrideCount.get(row.feature_key) ?? 0) + 1
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/settings"
        className="text-xs font-semibold text-fv-text-secondary hover:underline"
      >
        ← Settings
      </Link>
      <h1 className="mb-1 mt-1 text-2xl font-semibold text-fv-text-primary">
        Patient app features
      </h1>
      <p className="mb-4 rounded-lg bg-fv-bg-accent-soft p-3 text-sm text-fv-text-secondary">
        Changes here apply only to patients onboarded <strong>after</strong> the
        change. Existing patients keep their current state — use the patient
        detail page to override an individual patient.
      </p>

      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {FEATURES.map((feature) => {
          const def = defaultByKey.get(feature.key);
          const enabled = def?.enabled ?? feature.schemaDefault;
          const config = (def?.config ?? {}) as { nudge_time?: string };
          const overrides = overrideCount.get(feature.key) ?? 0;

          return (
            <li
              key={feature.key}
              className="rounded-xl bg-fv-bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-fv-text-primary">
                    {feature.label}
                  </div>
                  <div className="mt-0.5 text-xs text-fv-text-secondary">
                    {feature.description}
                  </div>
                </div>
                <form action={updateFeatureDefaultAction}>
                  <input
                    type="hidden"
                    name="feature_key"
                    value={feature.key}
                  />
                  <input
                    type="hidden"
                    name="enabled"
                    value={(!enabled).toString()}
                  />
                  {feature.key === "checkin_nudge" ? (
                    <input
                      type="hidden"
                      name="nudge_time"
                      value={config.nudge_time ?? "14:00"}
                    />
                  ) : null}
                  <button
                    type="submit"
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                      enabled
                        ? "bg-fv-accent-strong text-white"
                        : "border border-fv-border text-fv-text-secondary"
                    }`}
                  >
                    {enabled ? "ON" : "OFF"}
                  </button>
                </form>
              </div>

              {feature.note ? (
                <p className="mt-2 rounded-lg bg-fv-bg-accent-soft px-3 py-2 text-xs text-fv-text-secondary">
                  {feature.note}
                </p>
              ) : null}

              {feature.key === "checkin_nudge" ? (
                <form
                  action={updateFeatureDefaultAction}
                  className="mt-3 flex items-center gap-2"
                >
                  <input
                    type="hidden"
                    name="feature_key"
                    value={feature.key}
                  />
                  <input
                    type="hidden"
                    name="enabled"
                    value={enabled.toString()}
                  />
                  <label className="text-xs text-fv-text-secondary">
                    Nudge time
                  </label>
                  <select
                    name="nudge_time"
                    defaultValue={config.nudge_time ?? "14:00"}
                    className="rounded-md border border-fv-border bg-fv-bg-app px-2 py-1 text-xs"
                  >
                    {NUDGE_TIMES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-fv-border px-3 py-1 text-xs font-medium text-fv-text-primary"
                  >
                    Save time
                  </button>
                </form>
              ) : null}

              <div className="mt-3 text-xs text-fv-text-secondary">
                {overrides} patient{overrides === 1 ? "" : "s"} with an explicit
                override ·{" "}
                <Link
                  href={`/settings/patient-features/${feature.key}`}
                  className="font-medium text-fv-accent-strong hover:underline"
                >
                  Manage overrides
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

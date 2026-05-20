import Link from "next/link";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FEATURES, NUDGE_TIMES } from "@/lib/feature-flags";
import { updateFeatureDefaultAction } from "./actions";

export const dynamic = "force-dynamic";

// Per-feature icon + tile colour. Paths are stroked lucide-style glyphs.
const FEATURE_ICON: Record<string, { bg: string; path: ReactNode }> = {
  surgeon_spotlight: {
    bg: "bg-emerald-600",
    path: (
      <>
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" />
      </>
    ),
  },
  eye_photo_prompt: {
    bg: "bg-orange-500",
    path: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
  },
  checkin_nudge: {
    bg: "bg-amber-500",
    path: (
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </>
    ),
  },
  lockscreen_widget: {
    bg: "bg-slate-600",
    path: (
      <>
        <rect width="18" height="11" x="3" y="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  },
  feedback_tile: {
    bg: "bg-sky-600",
    path: (
      <path d="M12 2.5l2.9 6 6.6.6-5 4.3 1.5 6.5L12 16.5 5.5 20.4 7 13.9l-5-4.3 6.6-.6z" />
    ),
  },
  preop_tile: {
    bg: "bg-violet-600",
    path: (
      <>
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
      </>
    ),
  },
  bonus_theme_pack: {
    bg: "bg-fuchsia-600",
    path: (
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    ),
  },
};

function FeatureIcon({ featureKey }: { featureKey: string }) {
  const icon = FEATURE_ICON[featureKey] ?? FEATURE_ICON.feedback_tile!;
  return (
    <span
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${icon.bg}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        {icon.path}
      </svg>
    </span>
  );
}

export default async function PatientFeaturesSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: defaults },
    { data: flagRows },
    { data: doctorRows },
    { data: viewer },
  ] = await Promise.all([
    supabase.from("feature_defaults").select("*"),
    supabase
      .from("patient_feature_flags")
      .select("feature_key, enabled, changed_by_staff_id"),
    supabase
      .from("staff_users")
      .select("role, welcome_video_url, active"),
    user
      ? supabase
          .from("staff_users")
          .select("bonus_pack_unlocked")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // The bonus-theme-pack feature is a hidden Easter egg — hide it from
  // staff who haven't unlocked it themselves so the feature stays a
  // surprise. Once a staff member unlocks it, they see the admin row
  // and can enable it for individual patients.
  const visibleFeatures = viewer?.bonus_pack_unlocked
    ? FEATURES
    : FEATURES.filter((f) => f.key !== "bonus_theme_pack");

  const defaultByKey = new Map((defaults ?? []).map((d) => [d.feature_key, d]));

  // Per-feature: how many patients have it on / total / explicit overrides.
  const stats = new Map<
    string,
    { total: number; enabled: number; overrides: number }
  >();
  for (const row of flagRows ?? []) {
    const s = stats.get(row.feature_key) ?? {
      total: 0,
      enabled: 0,
      overrides: 0,
    };
    s.total += 1;
    if (row.enabled) s.enabled += 1;
    if (row.changed_by_staff_id) s.overrides += 1;
    stats.set(row.feature_key, s);
  }

  const surgeons = (doctorRows ?? []).filter(
    (d) => d.role === "surgeon" && d.active
  );
  const surgeonsWithVideo = surgeons.filter((d) => d.welcome_video_url).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-fv-text-primary">
          Optional features and their defaults
        </h2>
        <p className="mt-0.5 text-xs text-fv-text-secondary">
          Changes here apply only to patients onboarded after the change —
          existing patients keep their current state. Use the patient detail
          page to override an individual patient.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {visibleFeatures.map((feature) => {
            const def = defaultByKey.get(feature.key);
            const enabled = def?.enabled ?? feature.schemaDefault;
            const config = (def?.config ?? {}) as { nudge_time?: string };
            const s = stats.get(feature.key) ?? {
              total: 0,
              enabled: 0,
              overrides: 0,
            };

            return (
              <div
                key={feature.key}
                className="flex flex-wrap items-start gap-4 rounded-xl bg-fv-bg-soft/40 p-4"
              >
                <FeatureIcon featureKey={feature.key} />

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-fv-text-primary">
                    {feature.label}
                  </div>
                  <p className="mt-0.5 text-[13px] text-fv-text-secondary">
                    {feature.description} Currently{" "}
                    <strong className="text-fv-text-primary">
                      {enabled ? "ON" : "OFF"} by default
                    </strong>
                    .
                  </p>

                  <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fv-text-secondary">
                    <span>
                      <strong className="text-fv-text-primary">
                        Active for:
                      </strong>{" "}
                      {s.enabled} of {s.total} patient
                      {s.total === 1 ? "" : "s"}
                    </span>
                    {feature.key === "surgeon_spotlight" ? (
                      <span>
                        <strong className="text-fv-text-primary">
                          Surgeons with video:
                        </strong>{" "}
                        {surgeonsWithVideo} of {surgeons.length}
                      </span>
                    ) : null}
                    <Link
                      href={`/settings/patient-features/${feature.key}`}
                      className="font-medium text-fv-accent-strong hover:underline"
                    >
                      Manage overrides
                      {s.overrides > 0 ? ` (${s.overrides})` : ""}
                    </Link>
                  </div>

                  {feature.note ? (
                    <p className="mt-2 rounded-lg bg-fv-bg-accent-soft px-3 py-2 text-xs text-fv-text-secondary">
                      {feature.note}
                    </p>
                  ) : null}

                  {feature.key === "checkin_nudge" ? (
                    <form
                      action={updateFeatureDefaultAction}
                      className="mt-2 flex items-center gap-2"
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
                        className="rounded-md border border-fv-border px-3 py-1 text-xs font-medium text-fv-text-primary hover:bg-fv-bg-soft"
                      >
                        Save time
                      </button>
                    </form>
                  ) : null}
                </div>

                <form action={updateFeatureDefaultAction} className="shrink-0">
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
            );
          })}
        </div>
      </section>
    </main>
  );
}

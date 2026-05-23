import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { StaffPushOptIn } from "@/components/StaffPushOptIn";
import { StaffThemePicker } from "@/components/dashboard/StaffThemePicker";
import type { ThemePreference } from "@/lib/theme";
import { updateStaffTextSizeAction } from "./actions";
import { AfterHoursToggle } from "./AfterHoursToggle";
import { OnShiftToggle } from "./OnShiftToggle";
import { updateStaffQuietHoursAction } from "./shift-actions";

export const dynamic = "force-dynamic";

const SIZES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "small", label: "Small" },
  { key: "normal", label: "Normal" },
  { key: "large", label: "Large" },
];

// Settings → Appearance: dashboard theme + text size, per staff member.
export default async function AppearanceSettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: staff } = await supabase
    .from("staff_users")
    .select(
      "theme, dark_mode, sparkle, bonus_pack_unlocked, text_size, role, notify_after_hours, on_shift, quiet_hours, quiet_hours_start, quiet_hours_end"
    )
    .eq("id", user.id)
    .maybeSingle();

  const textSize = staff?.text_size ?? "normal";
  const isSurgeon = staff?.role === "surgeon";
  const notifyAfterHours = staff?.notify_after_hours ?? false;
  const onShift = staff?.on_shift ?? false;
  const quietHoursOn = staff?.quiet_hours ?? false;
  const quietHoursStart = staff?.quiet_hours_start ?? "22:00";
  const quietHoursEnd = staff?.quiet_hours_end ?? "07:00";

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-fv-text-primary">Theme</h2>
          <p className="mt-0.5 text-xs text-fv-text-secondary">
            Your dashboard colour theme — set per staff member, applied
            instantly.
          </p>
          <div className="mt-4">
            <StaffThemePicker
              initialTheme={(staff?.theme ?? "calm") as ThemePreference}
              initialDark={staff?.dark_mode ?? false}
              initialSparkle={staff?.sparkle ?? false}
              bonusUnlocked={staff?.bonus_pack_unlocked ?? false}
            />
          </div>
        </section>

        <StaffPushOptIn />

        <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-fv-text-primary">
            On shift
          </h2>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Flip on when you start your shift and off when you leave.
            General in-app alerts (the &quot;In-app alert to all staff&quot;
            action) only reach staff who are currently on shift. Urgent
            override alerts for selected roles ignore this and reach you
            either way.
          </p>
          <OnShiftToggle initial={onShift} />
        </section>

        <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-fv-text-primary">
            Quiet hours
          </h2>
          <p className="mt-1 text-sm text-fv-text-secondary">
            Pause general in-app alerts within this window. Urgent
            override alerts for selected roles still come through.
          </p>
          <form
            action={updateStaffQuietHoursAction}
            className="mt-3 flex flex-col gap-3"
          >
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-fv-text-primary">
                Enabled
              </span>
              <span className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  name="quiet_hours"
                  defaultChecked={quietHoursOn}
                  className="peer sr-only"
                />
                <span className="h-6 w-11 rounded-full bg-fv-bg-soft transition-colors peer-checked:bg-fv-accent-strong" />
                <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </span>
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-semibold text-fv-text-secondary">
                  From
                </span>
                <input
                  type="time"
                  name="quiet_hours_start"
                  defaultValue={quietHoursStart}
                  className="rounded-lg border border-fv-border bg-fv-bg-app px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-semibold text-fv-text-secondary">
                  To
                </span>
                <input
                  type="time"
                  name="quiet_hours_end"
                  defaultValue={quietHoursEnd}
                  className="rounded-lg border border-fv-border bg-fv-bg-app px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                className="self-end rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Save quiet hours
              </button>
            </div>
          </form>
        </section>

        {isSurgeon ? (
          <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-fv-text-primary">
              After-hours alerts for your patients
            </h2>
            <p className="mt-1 text-sm text-fv-text-secondary">
              When on, you can be added to the urgent override push for
              alerts about your own patients — even when you&apos;d
              normally be off-shift or in quiet hours. Off by default.
            </p>
            <AfterHoursToggle initial={notifyAfterHours} />
          </section>
        ) : null}

        <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-fv-text-primary">
            Text size
          </h2>
          <p className="mt-0.5 text-xs text-fv-text-secondary">
            Scales every label, number and field on the dashboard.
          </p>
          <div className="mt-4 flex gap-2">
            {SIZES.map((s) => (
              <form key={s.key} action={updateStaffTextSizeAction}>
                <input type="hidden" name="text_size" value={s.key} />
                <button
                  type="submit"
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    textSize === s.key
                      ? "bg-fv-accent-strong text-white"
                      : "border border-fv-border text-fv-text-primary hover:bg-fv-bg-soft"
                  }`}
                >
                  {s.label}
                </button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

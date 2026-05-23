import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { StaffPushOptIn } from "@/components/StaffPushOptIn";
import { StaffThemePicker } from "@/components/dashboard/StaffThemePicker";
import type { ThemePreference } from "@/lib/theme";
import { updateStaffTextSizeAction } from "./actions";

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
    .select("theme, dark_mode, sparkle, bonus_pack_unlocked, text_size")
    .eq("id", user.id)
    .maybeSingle();

  const textSize = staff?.text_size ?? "normal";

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

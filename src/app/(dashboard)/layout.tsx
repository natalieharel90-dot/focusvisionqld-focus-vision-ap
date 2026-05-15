import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  buildThemeCss,
  resolveThemePreference,
  shouldShowSparkle,
  type ThemePreference,
} from "@/lib/theme";
import { signOutAction } from "@/app/sign-out/actions";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SparkleOverlay } from "@/components/SparkleOverlay";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Belt-and-suspenders: middleware already redirected unauthenticated
  // users, but a patient (or any non-staff auth.user) could in theory
  // hold a session. Reject anyone not in staff_users.
  const { data: staff } = await supabase
    .from("staff_users")
    .select(
      "name, role, access_tier, theme, dark_mode, bonus_pack_unlocked, sparkle"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!staff) {
    await supabase.auth.signOut();
    redirect("/sign-in?error=Account+is+not+a+staff+member.");
  }

  // 'random' resolves to a random bonus theme on every load.
  const { theme, dark } = resolveThemePreference(staff);
  const showSparkle = shouldShowSparkle(staff.sparkle ?? false, false);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: buildThemeCss() }} />
      <div
        id="fv-dashboard-root"
        data-theme={theme}
        data-dark={dark ? "" : undefined}
        className="flex min-h-screen bg-fv-bg-app"
      >
      <Sidebar
        staffName={staff.name}
        staffRole={staff.role}
        accessTier={staff.access_tier}
        themePreference={staff.theme as ThemePreference}
        dark={dark}
        sparkle={staff.sparkle ?? false}
        bonusUnlocked={staff.bonus_pack_unlocked ?? false}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-fv-bg-soft bg-fv-bg-card px-6 py-2">
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-fv-bg-soft px-3 py-1.5 text-sm font-medium text-fv-text-primary hover:bg-fv-bg-soft"
            >
              Sign out
            </button>
          </form>
        </header>
        <div className="flex-1">{children}</div>
      </div>
      {showSparkle ? <SparkleOverlay /> : null}
      </div>
    </>
  );
}

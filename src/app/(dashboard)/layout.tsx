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
      "name, role, access_tier, theme, dark_mode, bonus_pack_unlocked, sparkle, text_size"
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

  // Sidebar nav badges — live counts of work waiting in each area.
  const headCount = { count: "exact" as const, head: true };
  const [newPatientsRes, unreadRes, flagsRes, alertRes, feedbackRes] =
    await Promise.all([
      supabase
        .from("patient_setup_tasks")
        .select("patient_id", headCount)
        .neq("status", "activated"),
      supabase
        .from("messages")
        .select("id", headCount)
        .eq("sender_type", "patient")
        .is("read_at", null),
      supabase
        .from("manual_flags")
        .select("id", headCount)
        .is("resolved_at", null),
      supabase
        .from("check_ins")
        .select("id", headCount)
        .neq("staff_alert_level", "none")
        .is("reviewed_at", null),
      supabase
        .from("feedback")
        .select("id", headCount)
        .is("acknowledged_at", null),
    ]);

  const navBadges: Record<string, number> = {
    "/new-patients": newPatientsRes.count ?? 0,
    "/inbox": unreadRes.count ?? 0,
    "/triage": (flagsRes.count ?? 0) + (alertRes.count ?? 0),
    "/reviews": feedbackRes.count ?? 0,
  };

  // Dashboard text size — scales every rem-based size while a dashboard
  // page is mounted. Set from Settings → Appearance.
  const rootFontPx =
    staff.text_size === "small" ? 15 : staff.text_size === "large" ? 18 : 16;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `${buildThemeCss()}\nhtml{font-size:${rootFontPx}px;}`,
        }}
      />
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
        navBadges={navBadges}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="fv-dash-header flex items-center justify-end gap-2 border-b border-fv-bg-soft bg-fv-bg-card px-6 py-2">
          <a
            href="/help"
            title="Help centre"
            aria-label="Help centre"
            className="grid h-8 w-8 place-items-center rounded-md border border-fv-bg-soft text-fv-text-primary hover:bg-fv-bg-soft"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </a>
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

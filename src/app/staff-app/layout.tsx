import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import {
  buildThemeCss,
  resolveThemePreference,
} from "@/lib/theme";
import { BottomNav } from "./StaffAppNav";

export const dynamic = "force-dynamic";

// The trimmed-down staff mobile app shell — shared dark header, the tab
// strip and the fixed bottom nav. Each route renders its own screen.
export default async function StaffAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: staff } = await supabase
    .from("staff_users")
    .select("name, display_name, role, theme, dark_mode, text_size, on_shift")
    .eq("id", user.id)
    .maybeSingle();
  if (!staff) redirect("/sign-in");

  // Match the dashboard's theme setup so the staff-app follows the same
  // appearance preferences (Settings → Appearance on the web dashboard).
  const { theme, dark } = resolveThemePreference(staff);
  const rootFontPx =
    staff.text_size === "small" ? 15 : staff.text_size === "large" ? 18 : 16;

  const [threadsRes, flagsRes] = await Promise.all([
    supabase.from("message_threads").select("unread_for_staff"),
    supabase.from("manual_flags").select("id").is("resolved_at", null),
  ]);
  const unread = (threadsRes.data ?? []).reduce(
    (n, t) => n + (t.unread_for_staff ?? 0),
    0
  );
  const flagged = (flagsRes.data ?? []).length;
  const name = staff.display_name || staff.name;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `${buildThemeCss()}\nhtml{font-size:${rootFontPx}px;}`,
        }}
      />
      <div
        id="fv-staff-app-root"
        data-theme={theme}
        data-dark={dark ? "" : undefined}
        className="mx-auto flex min-h-screen max-w-md flex-col bg-fv-bg-app"
      >
        {/* Dark header — same chrome the dashboard sidebar uses, so it
            follows the staff member's chosen theme. */}
        <header className="fv-dash-sidebar px-4 pb-4 pt-5 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-semibold">
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{name}</div>
            <div className="text-xs">
              <span className="capitalize text-white/70">{staff.role}</span>{" "}
              <span className="text-white/50">·</span>{" "}
              {staff.on_shift ? (
                <span className="text-emerald-200">on shift</span>
              ) : (
                <span className="text-white/50">off shift</span>
              )}
            </div>
          </div>
          <Link
            href="/staff-app/messages"
            aria-label={
              unread > 0 ? `${unread} unread messages` : "Messages"
            }
            className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unread > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold">
                {unread}
              </span>
            ) : null}
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/staff-app/messages"
            className="rounded-xl bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            <div className="text-xl font-bold">{unread}</div>
            <div className="text-xs text-white/70">Unread messages</div>
          </Link>
          <Link
            href="/staff-app/triage"
            className="rounded-xl bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            <div className="text-xl font-bold">{flagged}</div>
            <div className="text-xs text-white/70">Flagged · today</div>
          </Link>
        </div>
      </header>

        <main className="flex-1 pb-24">{children}</main>

        <BottomNav badges={{ messages: unread, triage: flagged }} />
      </div>
    </>
  );
}

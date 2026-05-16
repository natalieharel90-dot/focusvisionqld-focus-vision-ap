import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import { TopTabs, BottomNav } from "./StaffAppNav";

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
    .select("name, display_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!staff) redirect("/sign-in");

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-fv-bg-app">
      {/* Dark header */}
      <header className="bg-[#2b5249] px-4 pb-4 pt-5 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-semibold">
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{name}</div>
            <div className="text-xs text-white/70">
              <span className="capitalize">{staff.role}</span> · on shift
            </div>
          </div>
          <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/10">
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
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xl font-bold">{unread}</div>
            <div className="text-xs text-white/70">Unread messages</div>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xl font-bold">{flagged}</div>
            <div className="text-xs text-white/70">Flagged · today</div>
          </div>
        </div>
      </header>

      <TopTabs />

      <main className="flex-1 pb-24">{children}</main>

      <BottomNav badges={{ messages: unread, triage: flagged }} />
    </div>
  );
}

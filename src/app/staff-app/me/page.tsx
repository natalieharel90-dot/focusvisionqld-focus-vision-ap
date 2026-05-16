import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import { toggleNotificationPrefAction } from "@/app/(dashboard)/inbox/actions";
import { signOutAction } from "@/app/sign-out/actions";

export const dynamic = "force-dynamic";

type PrefKey =
  | "notify_new_message"
  | "notify_orange_flag"
  | "notify_yellow_flag"
  | "quiet_hours"
  | "daily_digest_email";

const NOTIFY_ROWS: ReadonlyArray<{
  key: PrefKey;
  title: string;
  sub: string;
  fallback: boolean;
}> = [
  {
    key: "notify_new_message",
    title: "New patient message",
    sub: "Push notification on this phone",
    fallback: true,
  },
  {
    key: "notify_orange_flag",
    title: "Orange zone flag",
    sub: "Highest concern alerts",
    fallback: true,
  },
  {
    key: "notify_yellow_flag",
    title: "Yellow zone flag",
    sub: "Mid-concern alerts",
    fallback: false,
  },
  {
    key: "quiet_hours",
    title: "Quiet hours",
    sub: "No push 7 PM – 7 AM",
    fallback: true,
  },
  {
    key: "daily_digest_email",
    title: "Daily digest email",
    sub: "8 AM summary every morning",
    fallback: true,
  },
];

export default async function StaffAppMe() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [staffRes, prefsRes] = await Promise.all([
    supabase
      .from("staff_users")
      .select("name, display_name, role")
      .eq("id", user?.id ?? "")
      .maybeSingle(),
    supabase
      .from("staff_notification_prefs")
      .select("*")
      .eq("staff_id", user?.id ?? "")
      .maybeSingle(),
  ]);
  const staff = staffRes.data;
  const prefs = prefsRes.data;
  const name = staff?.display_name || staff?.name || "Staff";

  return (
    <div className="pb-4">
      {/* Profile */}
      <div className="flex flex-col items-center bg-fv-bg-card px-4 py-6">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-600 text-xl font-semibold text-white">
          {initials(name)}
        </span>
        <div className="mt-3 text-lg font-semibold text-fv-text-primary">
          {name}
        </div>
        <div className="text-sm capitalize text-fv-text-secondary">
          {staff?.role ?? "—"} · Focus Vision
        </div>
      </div>

      {/* Notifications */}
      <div className="mt-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
        Notifications
      </div>
      <ul className="divide-y divide-fv-bg-soft border-y border-fv-bg-soft bg-fv-bg-card">
        {NOTIFY_ROWS.map((row) => {
          const on = (prefs?.[row.key] as boolean | undefined) ?? row.fallback;
          return (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-fv-text-primary">
                  {row.title}
                </div>
                <div className="text-xs text-fv-text-secondary">
                  {row.sub}
                </div>
              </div>
              <form action={toggleNotificationPrefAction}>
                <input type="hidden" name="pref" value={row.key} />
                <input
                  type="hidden"
                  name="enabled"
                  value={(!on).toString()}
                />
                <button
                  type="submit"
                  role="switch"
                  aria-checked={on}
                  className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors ${
                    on ? "bg-fv-accent-strong" : "bg-fv-bg-soft"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      on ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      {/* Account */}
      <div className="mt-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
        Account
      </div>
      <div className="divide-y divide-fv-bg-soft border-y border-fv-bg-soft bg-fv-bg-card">
        <Link
          href="/"
          className="flex items-center justify-between gap-3 px-4 py-3.5"
        >
          <div>
            <div className="text-sm font-semibold text-fv-text-primary">
              Open dashboard on web
            </div>
            <div className="text-xs text-fv-text-secondary">
              The full clinical dashboard
            </div>
          </div>
          <span className="text-fv-text-secondary">›</span>
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          >
            <div>
              <div className="text-sm font-semibold text-red-600">
                Sign out
              </div>
              <div className="text-xs text-fv-text-secondary">
                Other staff can still respond
              </div>
            </div>
          </button>
        </form>
      </div>
    </div>
  );
}

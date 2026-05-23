import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import { signOutAction } from "@/app/sign-out/actions";
import {
  NewMessageToggle,
  OnShiftToggle,
  QuietHoursCard,
} from "./StaffMeForms";

export const dynamic = "force-dynamic";

export default async function StaffAppMe() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [staffRes, prefsRes] = await Promise.all([
    supabase
      .from("staff_users")
      .select(
        "name, display_name, role, on_shift, quiet_hours, quiet_hours_start, quiet_hours_end, quiet_hours_override_orange, quiet_hours_override_red"
      )
      .eq("id", user?.id ?? "")
      .maybeSingle(),
    supabase
      .from("staff_notification_prefs")
      .select("notify_new_message")
      .eq("staff_id", user?.id ?? "")
      .maybeSingle(),
  ]);
  const staff = staffRes.data;
  const name = staff?.display_name || staff?.name || "Staff";

  const onShift = staff?.on_shift ?? false;
  const quietHoursOn = staff?.quiet_hours ?? false;
  const quietStart = staff?.quiet_hours_start ?? "22:00";
  const quietEnd = staff?.quiet_hours_end ?? "07:00";
  const overrideOrange = staff?.quiet_hours_override_orange ?? false;
  const overrideRed = staff?.quiet_hours_override_red ?? true;
  const newMessageOn = prefsRes.data?.notify_new_message ?? true;

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

      {/* Shift status */}
      <div className="mt-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
        Shift
      </div>
      <ul className="divide-y divide-fv-bg-soft border-y border-fv-bg-soft bg-fv-bg-card">
        <li className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-fv-text-primary">
              {onShift ? "On shift" : "Off shift"}
            </div>
            <div className="text-xs text-fv-text-secondary">
              {onShift
                ? "Receiving the general in-app alerts."
                : "Not receiving general alerts. Urgent override alerts still come through."}
            </div>
          </div>
          <OnShiftToggle initial={onShift} />
        </li>
      </ul>

      {/* Notifications */}
      <div className="mt-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
        Notifications
      </div>
      <ul className="divide-y divide-fv-bg-soft border-y border-fv-bg-soft bg-fv-bg-card">
        <li className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-fv-text-primary">
              New patient message
            </div>
            <div className="text-xs text-fv-text-secondary">
              Push notification when a patient messages the clinic
            </div>
          </div>
          <NewMessageToggle initial={newMessageOn} />
        </li>
      </ul>

      {/* Quiet hours */}
      <div className="mt-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary">
        Quiet hours
      </div>
      <div className="border-y border-fv-bg-soft bg-fv-bg-card">
        <QuietHoursCard
          enabled={quietHoursOn}
          start={quietStart}
          end={quietEnd}
          overrideOrange={overrideOrange}
          overrideRed={overrideRed}
        />
      </div>

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

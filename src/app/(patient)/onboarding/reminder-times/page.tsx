import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ReminderTimesEditor } from "@/components/patient/ReminderTimesEditor";
import { saveReminderTimesAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function OnboardingReminderTimesPage({
  searchParams,
}: {
  searchParams: { error?: string; from?: string };
}) {
  const fromSettings = searchParams.from === "settings";
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const [prefsRes, medsRes] = await Promise.all([
    supabase
      .from("user_preferences")
      .select(
        "medication_reminder_times, checkin_reminder_time, checkin_nudge_time, notify_checkin_nudge, reminder_times_set_at, onboarding_completed_at"
      )
      .eq("patient_id", user.id)
      .maybeSingle(),
    supabase
      .from("medications")
      .select("scheduled_times")
      .eq("patient_id", user.id)
      .is("stopped_at", null),
  ]);

  // The page is reachable from both first-run onboarding (via the home
  // redirect when reminder_times_set_at is null) and Settings (link
  // labelled "Reminder times"). No early redirect — the editor renders
  // for both cases.

  // The number of slots to show is the patient's max-frequency
  // medication. Capped at 6 (no real regimen needs more) and the
  // length of the seed default in user_preferences.
  const meds = medsRes.data ?? [];
  const maxSlots = Math.min(
    6,
    Math.max(0, ...meds.map((m) => m.scheduled_times.length))
  );

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-bold text-fv-text-primary">
          {fromSettings
            ? "Edit your reminder times"
            : "When should we remind you?"}
        </h1>
        <p className="mt-1.5 text-sm text-fv-text-secondary">
          {fromSettings
            ? "Adjust when each of your reminders fire. We'll update your medication schedule accordingly."
            : "Everyone's schedule is different. Pick the times that work for you — you can change them anytime in Settings."}
        </p>
      </header>

      {searchParams.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error === "invalid-time"
            ? "Please enter valid times for every reminder."
            : "Something went wrong saving your reminders. Please try again."}
        </p>
      ) : null}

      <ReminderTimesEditor
        initialMedicationTimes={
          prefsRes.data?.medication_reminder_times ?? []
        }
        maxMedicationSlots={maxSlots}
        initialCheckinTime={prefsRes.data?.checkin_reminder_time ?? "09:00"}
        initialNudgeTime={prefsRes.data?.checkin_nudge_time ?? "15:00"}
        nudgeEnabled={prefsRes.data?.notify_checkin_nudge ?? false}
        action={saveReminderTimesAction}
        isOnboarding={!fromSettings}
      />
    </main>
  );
}

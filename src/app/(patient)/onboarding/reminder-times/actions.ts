"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// Saves the patient's reminder-time preferences AND propagates them
// onto each of their active medications (each medication's
// scheduled_times array is set to the first N entries of the patient's
// list, where N is the medication's current dosing frequency).
//
// After saving, stamps reminder_times_set_at so the post-onboarding
// gate is satisfied, then sends the patient home.
export async function saveReminderTimesAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

  const medicationTimes = String(formData.get("medication_times") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => HHMM.test(t))
    .sort();
  const checkinTime = String(formData.get("checkin_time") ?? "").trim();
  const nudgeTime = String(formData.get("nudge_time") ?? "").trim();

  if (!HHMM.test(checkinTime) || !HHMM.test(nudgeTime)) {
    redirect("/onboarding/reminder-times?error=invalid-time");
  }

  await supabase.from("user_preferences").upsert(
    {
      patient_id: user.id,
      medication_reminder_times: medicationTimes,
      checkin_reminder_time: checkinTime,
      checkin_nudge_time: nudgeTime,
      reminder_times_set_at: new Date().toISOString(),
    },
    { onConflict: "patient_id" }
  );

  // Sync the patient's active medications: each med keeps its current
  // dosing frequency (the length of its scheduled_times array), and we
  // replace the times with the first N entries from the patient's list.
  if (medicationTimes.length > 0) {
    const { data: meds } = await supabase
      .from("medications")
      .select("id, scheduled_times")
      .eq("patient_id", user.id)
      .is("stopped_at", null);

    for (const med of meds ?? []) {
      const n = med.scheduled_times.length;
      if (n === 0) continue;
      const newTimes = medicationTimes.slice(0, n);
      // If the patient gave fewer slots than this med needs, keep the
      // extras from the existing schedule so we don't lose doses.
      while (newTimes.length < n) {
        newTimes.push(med.scheduled_times[newTimes.length]!);
      }
      await supabase
        .from("medications")
        .update({ scheduled_times: newTimes })
        .eq("id", med.id);
    }
  }

  const next = String(formData.get("next") ?? "/home");
  redirect(next === "/preferences" ? "/preferences" : "/home");
}

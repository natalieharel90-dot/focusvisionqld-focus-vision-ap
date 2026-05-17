import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PreferencesForm } from "./PreferencesForm";
import type { PreferencesPayload } from "./actions";

export const dynamic = "force-dynamic";

const DEFAULTS: PreferencesPayload = {
  theme: "calm",
  dark_mode: false,
  text_size: "normal",
  high_contrast: false,
  reduce_motion: false,
  language: "en",
  sparkle: false,
  notify_medication: true,
  notify_checkin: true,
  notify_messages: true,
  snooze_minutes: 10,
  notify_checkin_nudge: false,
  quiet_hours: false,
  lock_timezone: false,
  lock_screen_widget: false,
  voice_control: false,
};

export default async function PatientPreferencesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const [{ data: prefs }, { data: patient }] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("*")
      .eq("patient_id", user.id)
      .maybeSingle(),
    supabase
      .from("patients")
      .select("first_name, last_name, email, phone")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const initial: PreferencesPayload = prefs
    ? {
        theme: prefs.theme,
        dark_mode: prefs.dark_mode,
        text_size: prefs.text_size,
        high_contrast: prefs.high_contrast,
        reduce_motion: prefs.reduce_motion,
        language: prefs.language,
        sparkle: prefs.sparkle,
        notify_medication: prefs.notify_medication,
        notify_checkin: prefs.notify_checkin,
        notify_messages: prefs.notify_messages,
        snooze_minutes: prefs.snooze_minutes,
        notify_checkin_nudge: prefs.notify_checkin_nudge,
        quiet_hours: prefs.quiet_hours,
        lock_timezone: prefs.lock_timezone,
        lock_screen_widget: prefs.lock_screen_widget,
        voice_control: prefs.voice_control,
      }
    : DEFAULTS;

  const account = {
    name:
      [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") ||
      "Your account",
    email: patient?.email ?? null,
    phone: patient?.phone ?? null,
  };

  return (
    <PreferencesForm
      initial={initial}
      bonusUnlocked={prefs?.bonus_pack_unlocked ?? false}
      account={account}
    />
  );
}

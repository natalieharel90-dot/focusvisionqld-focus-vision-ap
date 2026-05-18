"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BONUS_THEME_IDS, THEME_IDS } from "@/lib/theme";

export type PreferencesPayload = {
  theme: string;
  dark_mode: boolean;
  text_size: string;
  high_contrast: boolean;
  reduce_motion: boolean;
  language: string;
  sparkle: boolean;
  notify_medication: boolean;
  notify_checkin: boolean;
  notify_messages: boolean;
  snooze_minutes: number;
  notify_checkin_nudge: boolean;
  quiet_hours: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  lock_timezone: boolean;
  lock_screen_widget: boolean;
  voice_control: boolean;
};

const VISIBLE_THEMES: string[] = [...THEME_IDS];
// Bonus themes + the 'random' meta-option require an unlocked pack.
const BONUS_THEMES: string[] = [...BONUS_THEME_IDS, "random"];
const SIZES = ["small", "normal", "large"];
const LANGS = ["en", "zh", "vi", "ar"];
const SNOOZE_MINUTES = [5, 10, 15, 30];

export type SaveResult = { ok: boolean; error?: string };

// Persists the patient's preference row (upsert). Theme/dark-mode
// changes are audit-logged via record_patient_audit — the patient is
// the actor, so it can't go through the staff-only audit RLS path.
export async function savePreferencesAction(
  payload: PreferencesPayload
): Promise<SaveResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const isVisible = VISIBLE_THEMES.includes(payload.theme);
  const isBonus = BONUS_THEMES.includes(payload.theme);
  if (!isVisible && !isBonus) {
    return { ok: false, error: "Invalid theme." };
  }
  if (!SIZES.includes(payload.text_size)) {
    return { ok: false, error: "Invalid text size." };
  }
  if (!LANGS.includes(payload.language)) {
    return { ok: false, error: "Invalid language." };
  }
  if (!SNOOZE_MINUTES.includes(payload.snooze_minutes)) {
    return { ok: false, error: "Invalid snooze duration." };
  }
  const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (!isTime(payload.quiet_hours_start) || !isTime(payload.quiet_hours_end)) {
    return { ok: false, error: "Enter a valid quiet-hours time." };
  }

  const { data: before } = await supabase
    .from("user_preferences")
    .select("theme, dark_mode, bonus_pack_unlocked")
    .eq("patient_id", user.id)
    .maybeSingle();

  // A bonus theme can only be selected once the pack is unlocked —
  // re-checked server-side so it can't be set via a crafted request.
  if (isBonus && !before?.bonus_pack_unlocked) {
    return { ok: false, error: "Bonus theme pack is not unlocked." };
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      patient_id: user.id,
      theme: payload.theme,
      dark_mode: payload.dark_mode,
      text_size: payload.text_size,
      high_contrast: payload.high_contrast,
      reduce_motion: payload.reduce_motion,
      language: payload.language,
      sparkle: payload.sparkle,
      notify_medication: payload.notify_medication,
      notify_checkin: payload.notify_checkin,
      notify_messages: payload.notify_messages,
      snooze_minutes: payload.snooze_minutes,
      notify_checkin_nudge: payload.notify_checkin_nudge,
      quiet_hours: payload.quiet_hours,
      quiet_hours_start: payload.quiet_hours_start,
      quiet_hours_end: payload.quiet_hours_end,
      lock_timezone: payload.lock_timezone,
      lock_screen_widget: payload.lock_screen_widget,
      voice_control: payload.voice_control,
    },
    { onConflict: "patient_id" }
  );
  if (error) return { ok: false, error: error.message };

  // Audit a theme/dark-mode change — helps later "why did the app look
  // different?" investigations.
  const themeChanged =
    !before ||
    before.theme !== payload.theme ||
    before.dark_mode !== payload.dark_mode;
  if (themeChanged) {
    await supabase.rpc("record_patient_audit", {
      p_event_type: "patient.theme_changed",
      p_new_value: {
        theme: payload.theme,
        dark_mode: payload.dark_mode,
      },
    });
  }

  revalidatePath("/preferences");
  return { ok: true };
}

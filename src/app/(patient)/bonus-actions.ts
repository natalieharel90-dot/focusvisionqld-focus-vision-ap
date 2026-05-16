"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadPatientFeatures } from "@/lib/patient-features-server";

export type UnlockResult = { ok: boolean };

// Marks the bonus theme pack unlocked for the current patient.
//
// The pack is now a staff-gated per-patient feature: the 13-click logo
// Easter egg only unlocks for patients whose staff have enabled the
// bonus_theme_pack feature flag. For an ineligible patient this returns
// { ok: false } silently — no unlock, no audit row — so the feature
// stays invisible to them and no "disabled" message is ever shown.
//
// Unlock is one-way and permanent: an already-unlocked patient stays
// unlocked even if staff later disable eligibility.
//
// Returns { ok: false } when there's no authenticated patient (e.g. the
// Easter egg was triggered on the sign-in screen) — the client falls
// back to a localStorage flag that the patient layout syncs post-login.
export async function unlockBonusPackAction(): Promise<UnlockResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!patient) return { ok: false };

  // Already unlocked — permanent, no re-check of eligibility.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("bonus_pack_unlocked")
    .eq("patient_id", user.id)
    .maybeSingle();
  if (prefs?.bonus_pack_unlocked) return { ok: true };

  // Staff gate: only patients with the bonus_theme_pack feature enabled
  // can self-unlock. Silent when ineligible.
  const features = await loadPatientFeatures(supabase, user.id);
  if (!features.bonus_theme_pack) return { ok: false };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { patient_id: user.id, bonus_pack_unlocked: true },
      { onConflict: "patient_id" }
    );
  if (error) return { ok: false };

  await supabase.rpc("record_patient_audit", {
    p_event_type: "patient.bonus_pack_unlocked",
    p_new_value: {},
  });

  revalidatePath("/preferences");
  return { ok: true };
}

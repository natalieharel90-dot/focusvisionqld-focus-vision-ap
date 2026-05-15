"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export type UnlockResult = { ok: boolean };

// Marks the bonus theme pack unlocked for the current patient. Returns
// { ok: false } when there's no authenticated patient (e.g. the
// Easter egg was triggered on the sign-in screen) — the client falls
// back to a localStorage flag that the patient layout syncs post-login.
// Unlock is one-way: there is no re-lock.
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

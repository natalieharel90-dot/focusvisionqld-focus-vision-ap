"use server";

import { revalidatePath } from "next/cache";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isBonusTheme, isValidTheme } from "@/lib/theme";

export type StaffThemeResult = { ok: boolean; error?: string };

// Persists a staff member's dashboard appearance to staff_users. Bonus
// themes (and the 'random' meta-option) are only accepted once the
// staff member has unlocked the bonus pack.
export async function updateStaffThemeAction(
  theme: string,
  dark: boolean,
  sparkle: boolean
): Promise<StaffThemeResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: staff } = await supabase
    .from("staff_users")
    .select("bonus_pack_unlocked")
    .eq("id", user.id)
    .maybeSingle();
  if (!staff) return { ok: false, error: "Not a staff member." };

  const isBonus = isBonusTheme(theme) || theme === "random";
  if (!isValidTheme(theme) && !isBonus) {
    return { ok: false, error: "Invalid theme." };
  }
  if (isBonus && !staff.bonus_pack_unlocked) {
    return { ok: false, error: "Bonus pack not unlocked." };
  }

  const { error } = await supabase
    .from("staff_users")
    .update({ theme, dark_mode: dark, sparkle })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  await recordStaffAudit(supabase, "staff.theme_changed", {
    entity_type: "staff_user",
    entity_id: user.id,
    new_value: { theme, dark_mode: dark, sparkle },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// Marks the bonus theme pack unlocked for the current staff member.
// Triggered by the dashboard logo Easter egg. Unlock is one-way.
export async function unlockStaffBonusPackAction(): Promise<StaffThemeResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: staff } = await supabase
    .from("staff_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!staff) return { ok: false, error: "Not a staff member." };

  const { error } = await supabase
    .from("staff_users")
    .update({ bonus_pack_unlocked: true })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  await recordStaffAudit(supabase, "staff.bonus_pack_unlocked", {
    entity_type: "staff_user",
    entity_id: user.id,
    new_value: {},
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

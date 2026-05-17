import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./supabase-server";
import type { Database } from "@/types/database.types";

export type StaffContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  staff: {
    id: string;
    name: string;
    role: string;
    access_tier: number;
  };
};

// Guard for staff server actions and route handlers. Server actions are
// independently callable HTTP endpoints — the dashboard layout's staff
// check does not protect them — so every staff action must verify the
// caller is a staff member itself. Redirects non-staff to sign-in.
export async function requireStaff(): Promise<StaffContext> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: staff } = await supabase
    .from("staff_users")
    .select("id, name, role, access_tier")
    .eq("id", user.id)
    .maybeSingle();
  if (!staff) redirect("/sign-in");

  return { supabase, userId: user.id, staff };
}

// As requireStaff, but also requires the staff member's access tier to be
// at or above `maxTier` (tier 1 = most privileged). Tier-restricted
// actions — analytics config, bulk push, reports — use this.
export async function requireStaffTier(
  maxTier: number
): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (ctx.staff.access_tier == null || ctx.staff.access_tier > maxTier) {
    redirect("/");
  }
  return ctx;
}

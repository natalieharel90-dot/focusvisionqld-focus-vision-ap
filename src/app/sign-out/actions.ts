"use server";

import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function signOutAction() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await recordStaffAudit(supabase, "staff.signed_out");
  }

  await supabase.auth.signOut();
  redirect("/sign-in");
}

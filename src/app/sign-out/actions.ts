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
    // Going off shift on sign-out so a forgotten toggle doesn't leave
    // the staff member receiving general alerts they're not actually
    // working through. They'll re-toggle "On shift" next time they
    // start a shift.
    await supabase
      .from("staff_users")
      .update({ on_shift: false })
      .eq("id", user.id);
  }

  await supabase.auth.signOut();
  redirect("/sign-in");
}

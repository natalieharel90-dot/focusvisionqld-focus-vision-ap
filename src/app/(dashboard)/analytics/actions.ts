"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Refreshes every analytics materialized view via the SECURITY DEFINER
// refresh_analytics() function. Wired to the "Refresh data" button.
export async function refreshAnalyticsAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.rpc("refresh_analytics");
  if (error) {
    redirect(`/analytics?error=${encodeURIComponent(error.message)}`);
  }

  await recordStaffAudit(supabase, "analytics.refreshed", {
    entity_type: "analytics",
  });

  // Preserve the active filters across the refresh.
  const qs = String(formData.get("qs") ?? "");
  revalidatePath("/analytics");
  redirect(`/analytics${qs ? `?${qs}&` : "?"}refreshed=1`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ANALYTICS_CARD_KEYS } from "./cards";

function clampPct(raw: string): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

// Saves the clinic-wide target percentages and this staff member's
// preferred stat-card order, from the analytics Edit modal.
export async function saveAnalyticsSettingsAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const responseHours = Math.max(
    0,
    Number(formData.get("staff_response_hours") ?? 0) || 0
  );
  const targets = {
    checkin_completion_pct: clampPct(
      String(formData.get("checkin_completion_pct") ?? "")
    ),
    medication_adherence_pct: clampPct(
      String(formData.get("medication_adherence_pct") ?? "")
    ),
    staff_response_hours: Math.round(responseHours * 10) / 10,
    red_alert_rate_pct: clampPct(
      String(formData.get("red_alert_rate_pct") ?? "")
    ),
  };

  // Reconcile the submitted order — keep valid keys, append any missing.
  const submitted = String(formData.get("card_order") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is (typeof ANALYTICS_CARD_KEYS)[number] =>
      (ANALYTICS_CARD_KEYS as readonly string[]).includes(s)
    );
  const cardOrder = [
    ...new Set([...submitted, ...ANALYTICS_CARD_KEYS]),
  ];

  const { error: targetError } = await supabase
    .from("analytics_targets")
    .update({ ...targets, updated_by: user.id })
    .eq("id", true);
  if (targetError) {
    redirect(`/analytics?error=${encodeURIComponent(targetError.message)}`);
  }

  const { error: layoutError } = await supabase
    .from("staff_analytics_layout")
    .upsert(
      { staff_id: user.id, card_order: cardOrder },
      { onConflict: "staff_id" }
    );
  if (layoutError) {
    redirect(`/analytics?error=${encodeURIComponent(layoutError.message)}`);
  }

  await recordStaffAudit(supabase, "settings.analytics_targets_updated", {
    entity_type: "analytics_targets",
    new_value: targets,
  });

  const qs = String(formData.get("qs") ?? "");
  revalidatePath("/analytics");
  redirect(`/analytics${qs ? `?${qs}` : ""}`);
}

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

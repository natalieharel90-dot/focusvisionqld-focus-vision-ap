"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function back(message: string): never {
  redirect(`/triage?error=${encodeURIComponent(message)}`);
}

export async function markCheckInReviewedAction(formData: FormData) {
  const checkInId = String(formData.get("check_in_id") ?? "");
  if (!checkInId) back("Missing check-in id.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: before } = await supabase
    .from("check_ins")
    .select("patient_id, staff_alert_level, recovery_day")
    .eq("id", checkInId)
    .single();

  const { error } = await supabase
    .from("check_ins")
    .update({
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", checkInId);
  if (error) back(error.message);

  await recordStaffAudit(supabase, "patient.check_in_reviewed", {
    patient_id: before?.patient_id ?? null,
    entity_type: "check_in",
    entity_id: checkInId,
    new_value: {
      staff_alert_level: before?.staff_alert_level ?? null,
      recovery_day: before?.recovery_day ?? null,
    },
  });

  revalidatePath("/triage");
  if (before?.patient_id) {
    revalidatePath(`/patients/${before.patient_id}`);
  }
}

export async function resolveManualFlagAction(formData: FormData) {
  const flagId = String(formData.get("flag_id") ?? "");
  if (!flagId) back("Missing flag id.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: before } = await supabase
    .from("manual_flags")
    .select("*")
    .eq("id", flagId)
    .single();

  const { error } = await supabase
    .from("manual_flags")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by_staff_id: user.id,
    })
    .eq("id", flagId);
  if (error) back(error.message);

  await recordStaffAudit(supabase, "patient.flag_resolved", {
    patient_id: before?.patient_id ?? null,
    entity_type: "manual_flag",
    entity_id: flagId,
    old_value: before,
    new_value: {
      ...(before ?? {}),
      resolved_at: new Date().toISOString(),
      resolved_by_staff_id: user.id,
    },
  });

  revalidatePath("/triage");
  if (before?.patient_id) {
    revalidatePath(`/patients/${before.patient_id}`);
  }
}

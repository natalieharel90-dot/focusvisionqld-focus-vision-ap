"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

type AlertLevel = Exclude<
  Database["public"]["Enums"]["staff_alert_level"],
  "none"
>;

const VALID_LEVELS: ReadonlyArray<AlertLevel> = ["yellow", "orange", "red"];

function back(message: string): never {
  redirect(
    `/settings/alert-thresholds?error=${encodeURIComponent(message)}`
  );
}

export async function saveAlertActionsAction(formData: FormData) {
  const level = String(formData.get("alert_level") ?? "") as AlertLevel;
  if (!VALID_LEVELS.includes(level)) back("Invalid alert level.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const update = {
    email_clinic: formData.get("email_clinic") === "on",
    inapp_to_all: formData.get("inapp_to_all") === "on",
    push_to_oncall: formData.get("push_to_oncall") === "on",
    sms_oncall: formData.get("sms_oncall") === "on",
    autocall_oncall: formData.get("autocall_oncall") === "on",
    additional_email:
      String(formData.get("additional_email") ?? "").trim() || null,
    oncall_number:
      String(formData.get("oncall_number") ?? "").trim() || null,
    updated_by: user.id,
  };

  const { data: before } = await supabase
    .from("zone_alert_actions")
    .select("*")
    .eq("alert_level", level)
    .maybeSingle();

  const { error } = await supabase
    .from("zone_alert_actions")
    .update(update)
    .eq("alert_level", level);
  if (error) back(error.message);

  await recordStaffAudit(supabase, "settings.alert_actions_updated", {
    entity_type: "zone_alert_actions",
    entity_id: level,
    old_value: before,
    new_value: { alert_level: level, ...update },
  });

  revalidatePath("/settings/alert-thresholds");
}

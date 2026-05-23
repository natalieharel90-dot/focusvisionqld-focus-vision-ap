"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";
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

  const { supabase, userId } = await requireStaff();

  const overrideRoles = formData
    .getAll("override_role_keys")
    .map((v) => String(v).trim().toLowerCase())
    .filter((v) => v.length > 0);

  const update = {
    email_clinic: formData.get("email_clinic") === "on",
    inapp_to_all: formData.get("inapp_to_all") === "on",
    override_role_keys: overrideRoles,
    include_surgeon_override:
      formData.get("include_surgeon_override") === "on",
    updated_by: userId,
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

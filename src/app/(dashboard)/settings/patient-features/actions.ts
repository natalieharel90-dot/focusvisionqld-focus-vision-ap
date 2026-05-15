"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FEATURE_BY_KEY } from "@/lib/feature-flags";
import type { Json } from "@/types/database.types";

// Updates a clinic-wide feature default. Per spec §6 this only affects
// patients onboarded afterwards — existing patients already have their
// own snapshotted flag rows, so they are untouched.
export async function updateFeatureDefaultAction(formData: FormData) {
  const featureKey = String(formData.get("feature_key") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const nudgeTime = String(formData.get("nudge_time") ?? "").trim();

  const back = (msg?: string): never =>
    redirect(
      `/settings/patient-features${
        msg ? `?error=${encodeURIComponent(msg)}` : ""
      }`
    );

  if (!FEATURE_BY_KEY.has(featureKey)) back("Unknown feature.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patch: { enabled: boolean; updated_by: string; config?: Json } = {
    enabled,
    updated_by: user.id,
  };
  if (featureKey === "checkin_nudge" && nudgeTime) {
    patch.config = { nudge_time: nudgeTime } as unknown as Json;
  }

  const { error } = await supabase
    .from("feature_defaults")
    .update(patch)
    .eq("feature_key", featureKey);
  if (error) back(error.message);

  await recordStaffAudit(supabase, "settings.feature_default_updated", {
    entity_type: "feature_default",
    new_value: {
      feature_key: featureKey,
      enabled,
      nudge_time: nudgeTime || null,
    },
  });

  revalidatePath("/settings/patient-features");
  back();
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function back(message: string): never {
  redirect(`/settings/symptoms?error=${encodeURIComponent(message)}`);
}

export async function addSymptomAction(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim();
  const orderIndex = Number(formData.get("order_index") ?? 999);

  if (!key || !label) back("Both key and label are required.");
  if (!/^[a-z][a-z0-9_]*$/.test(key))
    back("Key must be snake_case (letters, digits, underscores; start with a letter).");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await supabase
    .from("symptom_options")
    .insert({ key, label, order_index: orderIndex, active: true })
    .select()
    .single();
  if (error) back(error.message);

  // The DB trigger creates a default-ruleset routing_rules row with
  // route='orange' automatically.
  await recordStaffAudit(supabase, "settings.symptom_added", {
    entity_type: "symptom_option",
    entity_id: data!.id,
    new_value: { key, label },
  });

  revalidatePath("/settings/alert-thresholds");
  redirect(`/settings/symptoms?added=${encodeURIComponent(label)}`);
}

export async function toggleSymptomAction(formData: FormData) {
  const id = String(formData.get("symptom_id") ?? "");
  const nextActive = formData.get("next_active") === "1";
  if (!id) back("Missing symptom id.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: before } = await supabase
    .from("symptom_options")
    .select("key, label, active")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("symptom_options")
    .update({ active: nextActive })
    .eq("id", id);
  if (error) back(error.message);

  await recordStaffAudit(supabase, "settings.symptom_toggled", {
    entity_type: "symptom_option",
    entity_id: id,
    old_value: before,
    new_value: { ...(before ?? {}), active: nextActive },
  });

  revalidatePath("/settings/symptoms");
  revalidatePath("/settings/alert-thresholds");
}

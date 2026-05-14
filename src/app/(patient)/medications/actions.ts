"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

const VALID_SNOOZE_MINUTES = new Set([15, 30, 60]);

function back(message: string): never {
  redirect(`/medications?error=${encodeURIComponent(message)}`);
}

export async function markTakenAction(formData: FormData) {
  const doseId = String(formData.get("dose_id") ?? "");
  if (!doseId) back("Missing dose id.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const { error } = await supabase
    .from("medication_doses")
    .update({ taken_at: new Date().toISOString() })
    .eq("id", doseId);

  if (error) back(error.message);
  revalidatePath("/medications");
}

export async function snoozeAction(formData: FormData) {
  const doseId = String(formData.get("dose_id") ?? "");
  const minutes = Number(formData.get("minutes"));
  if (!doseId) back("Missing dose id.");
  if (!VALID_SNOOZE_MINUTES.has(minutes)) back("Invalid snooze interval.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  // Read first so we can push scheduled_at forward and increment count
  // atomically (no UPDATE … RETURNING because supabase-js doesn't expose
  // SQL-level arithmetic in update()).
  const { data: dose, error: readError } = await supabase
    .from("medication_doses")
    .select("scheduled_at, snooze_count")
    .eq("id", doseId)
    .single();
  if (readError) back(readError.message);

  const next = new Date(
    new Date(dose!.scheduled_at).getTime() + minutes * 60_000
  ).toISOString();

  const { error: updateError } = await supabase
    .from("medication_doses")
    .update({
      scheduled_at: next,
      snooze_count: dose!.snooze_count + 1,
    })
    .eq("id", doseId);

  if (updateError) {
    // 23505 = unique_violation. Happens when the new scheduled_at lands
    // on another existing dose for the same medication — friendly message
    // instead of the raw constraint name.
    if (updateError.code === "23505") {
      back(
        "Can't snooze that long — another dose for this medication is already scheduled at that time."
      );
    }
    back(updateError.message);
  }
  revalidatePath("/medications");
}

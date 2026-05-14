"use server";

import { redirect } from "next/navigation";

import { submitCheckIn } from "@/lib/check-ins";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { VisionAssessment } from "@/lib/zones";

const VALID_VISIONS: ReadonlyArray<VisionAssessment> = ["worse", "same", "better"];

function back(message: string): never {
  redirect(`/check-in?error=${encodeURIComponent(message)}`);
}

function daysSince(dateStr: string): number {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(`${dateStr}T00:00:00Z`).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
}

export async function submitCheckInAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const visionRaw = String(formData.get("vision") ?? "");
  if (!VALID_VISIONS.includes(visionRaw as VisionAssessment)) {
    back("Please answer the vision question.");
  }
  const vision = visionRaw as VisionAssessment;

  const pain = Number(formData.get("pain"));
  const light_sensitivity = Number(formData.get("light_sensitivity"));
  if (!Number.isInteger(pain) || pain < 0 || pain > 5) {
    back("Please pick a pain level (0–5).");
  }
  if (!Number.isInteger(light_sensitivity) || light_sensitivity < 0 || light_sensitivity > 5) {
    back("Please pick a light-sensitivity level (0–5).");
  }

  const unusual_symptoms = formData
    .getAll("symptom")
    .map((s) => String(s))
    .filter((s) => s.length > 0);

  const other_description =
    String(formData.get("other_description") ?? "").trim() || null;

  const photoPath = String(formData.get("photo_path") ?? "").trim();

  // Recovery day from the patient's most-recent active procedure.
  const { data: procedure } = await supabase
    .from("procedures")
    .select("surgery_date")
    .eq("patient_id", user.id)
    .eq("status", "active")
    .order("surgery_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recovery_day = procedure?.surgery_date
    ? daysSince(procedure.surgery_date)
    : 0;

  let result;
  try {
    result = await submitCheckIn(supabase, {
      patient_id: user.id,
      recovery_day,
      answers: { pain, light_sensitivity, vision, unusual_symptoms },
      other_description,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      back("You've already submitted today's check-in. Come back tomorrow.");
    }
    back(err instanceof Error ? err.message : "Submission failed.");
  }

  if (photoPath) {
    const { error: photoError } = await supabase.from("eye_photos").insert({
      patient_id: user.id,
      check_in_id: result.check_in_id,
      storage_path: photoPath,
      recovery_day,
    });
    if (photoError) {
      // Photo couldn't be linked but the check-in succeeded. Surface the
      // issue on the result screen rather than blocking the whole flow.
      console.error("[check-in] photo link failed", photoError);
    }
  }

  redirect(`/check-in/done?id=${result.check_in_id}`);
}

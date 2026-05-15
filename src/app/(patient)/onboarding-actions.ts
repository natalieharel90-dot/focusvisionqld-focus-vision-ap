"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildOnboardingAudit, type OnboardingOutcome } from "@/lib/onboarding";
import type { Json } from "@/types/database.types";

export type CompleteOnboardingInput = {
  viewedStepKeys: string[];
  outcome: OnboardingOutcome;
  mode: "first-run" | "replay";
};

// Records the end of the onboarding tour. First-run stamps
// onboarding_completed_at so the tour never re-fires; a replay leaves it
// untouched. Either way the run is audit-logged with the steps seen.
export async function completeOnboardingAction(
  input: CompleteOnboardingInput
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (input.mode === "first-run") {
    await supabase.from("user_preferences").upsert(
      {
        patient_id: user.id,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: "patient_id" }
    );
  }

  await supabase.rpc("record_patient_audit_event", {
    p_event_type:
      input.outcome === "completed"
        ? "patient.onboarding_completed"
        : "patient.onboarding_skipped",
    p_entity_type: "onboarding",
    p_new_value: buildOnboardingAudit(
      input.viewedStepKeys,
      input.outcome
    ) as unknown as Json,
  });
}

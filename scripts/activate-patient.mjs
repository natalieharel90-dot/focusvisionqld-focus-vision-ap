// Puts one seed patient into the "freshly activated" state so the
// onboarding tour fires on next sign-in: creates an activated
// patient_setup_tasks row. Idempotent.
//
// Run:  node --env-file=.env.local scripts/activate-patient.mjs

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STAFF_EMAIL = "maria.chen@focusvision.dev";
const STAFF_PASSWORD = "seed-only-do-not-use";
const PATIENT_EMAIL = "patient.three@example.dev";

if (!URL || !ANON) {
  console.error("Missing Supabase env vars. Run with --env-file=.env.local");
  process.exit(1);
}

const supabase = createClient(URL, ANON);

const { error: signInError } = await supabase.auth.signInWithPassword({
  email: STAFF_EMAIL,
  password: STAFF_PASSWORD,
});
if (signInError) {
  console.error("Staff sign-in failed:", signInError.message);
  process.exit(1);
}
const {
  data: { user: staff },
} = await supabase.auth.getUser();

const { data: patient, error: patientError } = await supabase
  .from("patients")
  .select("id, name")
  .eq("email", PATIENT_EMAIL)
  .maybeSingle();
if (patientError || !patient) {
  console.error("Patient not found:", patientError?.message ?? PATIENT_EMAIL);
  process.exit(1);
}

const { error: upsertError } = await supabase
  .from("patient_setup_tasks")
  .upsert(
    {
      patient_id: patient.id,
      status: "activated",
      checklist: {},
      activated_at: new Date().toISOString(),
      activated_by_staff_id: staff?.id ?? null,
    },
    { onConflict: "patient_id" }
  );
if (upsertError) {
  console.error("Could not set setup task:", upsertError.message);
  process.exit(1);
}

const { data: prefs } = await supabase
  .from("user_preferences")
  .select("onboarding_completed_at")
  .eq("patient_id", patient.id)
  .maybeSingle();

console.log(`Activated: ${patient.name} <${PATIENT_EMAIL}>`);
if (prefs?.onboarding_completed_at) {
  console.log(
    "WARNING: this patient already has onboarding_completed_at set —",
    "the tour will NOT fire. Use a different patient or clear that column."
  );
} else {
  console.log("onboarding_completed_at is empty — the tour will fire on /home.");
}

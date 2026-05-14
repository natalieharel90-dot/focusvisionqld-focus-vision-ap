// Daily check-in submission helper. Runs the routing engine over the
// patient's answers, narrowed by their active procedure context, then
// inserts a check_ins row with the engine-computed patient_zone and
// staff_alert_level. The patient app's server action is a thin wrapper
// around this; the staff dashboard can also call it when entering a
// check-in on a patient's behalf.

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadRulesetIndex,
  routeCheckIn,
  type CheckInAnswers,
  type PatientRoutingContext,
  type RoutingResult,
} from "./zones";
import type { Database } from "@/types/database.types";

export type SubmitCheckInInput = {
  patient_id: string;
  recovery_day: number;
  answers: CheckInAnswers;
  other_description?: string | null;
};

export type SubmitCheckInResult = RoutingResult & {
  check_in_id: string;
  patient_context: PatientRoutingContext;
};

export async function submitCheckIn(
  supabase: SupabaseClient<Database>,
  input: SubmitCheckInInput
): Promise<SubmitCheckInResult> {
  // Most-recent active procedure wins (e.g. second-eye surgery scheduled
  // later). If there's no active procedure the context falls through to
  // the default ruleset.
  const { data: procedure, error: procError } = await supabase
    .from("procedures")
    .select("procedure_type, surgeon_id")
    .eq("patient_id", input.patient_id)
    .eq("status", "active")
    .order("surgery_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (procError) throw procError;

  const patientContext: PatientRoutingContext = {
    procedure_type: procedure?.procedure_type ?? null,
    surgeon_id: procedure?.surgeon_id ?? null,
  };

  const index = await loadRulesetIndex(supabase, patientContext);
  const result = routeCheckIn(input.answers, patientContext, index);

  const { data: row, error: insertError } = await supabase
    .from("check_ins")
    .insert({
      patient_id: input.patient_id,
      recovery_day: input.recovery_day,
      vision: input.answers.vision,
      pain: input.answers.pain,
      light_sensitivity: input.answers.light_sensitivity,
      unusual_symptoms: [...input.answers.unusual_symptoms],
      other_description: input.other_description ?? null,
      patient_zone: result.patient_zone,
      staff_alert_level: result.staff_alert_level,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  return {
    ...result,
    check_in_id: row.id,
    patient_context: patientContext,
  };
}

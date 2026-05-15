// Server-side resolver for a patient's effective feature-flag state.
// Combines patient_feature_flags (override) with feature_defaults
// (clinic-wide) and the schema defaults. Used wherever the patient app
// needs to show/hide an optional feature.

import type { SupabaseClient } from "@supabase/supabase-js";

import { FEATURES, resolveFeature, type FeatureKey } from "./feature-flags";
import type { Database } from "@/types/database.types";

export type PatientFeatures = Record<FeatureKey, boolean>;

export async function loadPatientFeatures(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<PatientFeatures> {
  const [flagsRes, defaultsRes] = await Promise.all([
    supabase
      .from("patient_feature_flags")
      .select("feature_key, enabled")
      .eq("patient_id", patientId),
    supabase.from("feature_defaults").select("feature_key, enabled"),
  ]);

  const flags = new Map(
    (flagsRes.data ?? []).map((r) => [r.feature_key, { enabled: r.enabled }])
  );
  const defaults = new Map(
    (defaultsRes.data ?? []).map((r) => [r.feature_key, { enabled: r.enabled }])
  );

  const result = {} as PatientFeatures;
  for (const feature of FEATURES) {
    result[feature.key] = resolveFeature(
      flags.get(feature.key) ?? null,
      defaults.get(feature.key) ?? null,
      feature.schemaDefault
    );
  }
  return result;
}

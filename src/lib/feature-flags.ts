// Per-feature toggles (spec §6) — pure metadata + resolution. The
// effective state for a patient is: their explicit flag row > the
// clinic-wide default > the schema default baked in here.

export type FeatureKey =
  | "surgeon_spotlight"
  | "eye_photo_prompt"
  | "checkin_nudge"
  | "lockscreen_widget"
  | "feedback_tile"
  | "preop_tile"
  | "bonus_theme_pack";

export type FeatureMeta = {
  key: FeatureKey;
  label: string;
  description: string;
  // Code-level fallback when neither a patient flag nor a clinic default
  // row exists.
  schemaDefault: boolean;
  hasConfig: boolean;
  // Optional extra guidance shown beneath the toggle in clinic settings.
  note?: string;
};

export const FEATURES: ReadonlyArray<FeatureMeta> = [
  {
    key: "surgeon_spotlight",
    label: "Surgeon Spotlight video",
    description:
      "A personal welcome video on the patient's home screen. Opt-in per patient.",
    schemaDefault: false,
    hasConfig: false,
  },
  {
    key: "eye_photo_prompt",
    label: "Eye photo prompt during check-in",
    description: "Asks the patient to add an eye photo with their daily check-in.",
    schemaDefault: true,
    hasConfig: false,
  },
  {
    key: "checkin_nudge",
    label: "Daily check-in nudge",
    description:
      "A gentle reminder if the patient hasn't checked in by the nudge time.",
    schemaDefault: true,
    hasConfig: true,
  },
  {
    key: "lockscreen_widget",
    label: "Lock-screen widget opt-in offer",
    description: "Offers the next-dose lock-screen widget in patient settings.",
    schemaDefault: true,
    hasConfig: false,
  },
  {
    key: "feedback_tile",
    label: "Feedback tile on home",
    description: "Shows the Feedback tile on the patient home screen.",
    schemaDefault: true,
    hasConfig: false,
  },
  {
    key: "preop_tile",
    label: "Pre-op tile pre-surgery",
    description: "Shows the Before-your-surgery tile until the surgery date.",
    schemaDefault: true,
    hasConfig: false,
  },
  {
    key: "bonus_theme_pack",
    label: "Bonus theme pack",
    description:
      "Lets the patient discover a hidden pack of twelve extra app themes.",
    schemaDefault: false,
    hasConfig: false,
    note: "When enabled per patient, the patient can discover the theme pack themselves via the hidden activation in the app. Off by default — enable only for patients you know would enjoy it.",
  },
];

export const FEATURE_BY_KEY: ReadonlyMap<string, FeatureMeta> = new Map(
  FEATURES.map((f) => [f.key, f])
);

// Time-of-day options for the daily check-in nudge (patient local time).
export const NUDGE_TIMES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "12:00", label: "12 PM" },
  { value: "14:00", label: "2 PM" },
  { value: "16:00", label: "4 PM" },
  { value: "18:00", label: "6 PM" },
];

type FlagRow = { enabled: boolean } | null | undefined;

// Effective state: patient flag wins, then the clinic default, then the
// schema default. Because an activated patient always has a flag row,
// changing a clinic default never retroactively changes them.
export function resolveFeature(
  patientFlag: FlagRow,
  clinicDefault: FlagRow,
  schemaDefault: boolean
): boolean {
  if (patientFlag != null) return patientFlag.enabled;
  if (clinicDefault != null) return clinicDefault.enabled;
  return schemaDefault;
}

// Resolves one feature by key from a patient-flag map and a clinic-default
// map (both keyed by feature_key).
export function resolveFeatureByKey(
  key: FeatureKey,
  patientFlags: ReadonlyMap<string, { enabled: boolean }>,
  clinicDefaults: ReadonlyMap<string, { enabled: boolean }>
): boolean {
  return resolveFeature(
    patientFlags.get(key) ?? null,
    clinicDefaults.get(key) ?? null,
    FEATURE_BY_KEY.get(key)?.schemaDefault ?? false
  );
}

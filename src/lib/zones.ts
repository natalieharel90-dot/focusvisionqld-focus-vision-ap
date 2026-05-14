// Daily check-in routing engine.
//
// Implements spec section 6.7 and CLAUDE.md "Routing model":
//
//   Every routable answer (each pain level 0–5, each light-sensitivity
//   level 0–5, each vision option, each symptom chip) has its own row in
//   routing_rules with a single `route` column ∈ {off, yellow, orange, red}.
//
//   Lookup walks four tiers from most-specific to least, falling back
//   per-rule (not per-ruleset):
//     1. (procedure × surgeon)
//     2. surgeon-only        (procedure_type = NULL)
//     3. procedure-only      (surgeon_id     = NULL)
//     4. default             (both NULL)
//
//   patient_zone     = most severe patient-facing zone (red collapses to
//                      orange — patients never see red). green = no flag.
//   staff_alert_level = most severe route returned (red > orange > yellow
//                      > off). May be red even when patient_zone is orange.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export type RouteAction = "off" | "yellow" | "orange" | "red";
export type PatientZone = "green" | "yellow" | "orange";
export type StaffAlertLevel = "none" | "yellow" | "orange" | "red";
export type VisionAssessment = "worse" | "same" | "better";

export type SourceTier =
  | "procedure_surgeon"
  | "surgeon"
  | "procedure"
  | "default";

export type CheckInAnswers = {
  pain: number;
  light_sensitivity: number;
  vision: VisionAssessment;
  unusual_symptoms: ReadonlyArray<string>;
};

export type PatientRoutingContext = {
  procedure_type: string | null;
  surgeon_id: string | null;
};

export type RuleHit = {
  item_key: string;
  item_value: string;
  route: RouteAction;
  source_tier: SourceTier;
};

export type RoutingResult = {
  patient_zone: PatientZone;
  staff_alert_level: StaffAlertLevel;
  firing_rules: RuleHit[];
};

export type RulesetIndex = {
  procedure_surgeon: ReadonlyMap<string, RouteAction>;
  surgeon: ReadonlyMap<string, RouteAction>;
  procedure: ReadonlyMap<string, RouteAction>;
  default: ReadonlyMap<string, RouteAction>;
};

const ROUTE_SEVERITY: Record<RouteAction, number> = {
  off: 0,
  yellow: 1,
  orange: 2,
  red: 3,
};

const PATIENT_SEVERITY: Record<"off" | "yellow" | "orange", number> = {
  off: 0,
  yellow: 1,
  orange: 2,
};

const TIER_ORDER: ReadonlyArray<SourceTier> = [
  "procedure_surgeon",
  "surgeon",
  "procedure",
  "default",
];

const ruleKey = (item_key: string, item_value: string): string =>
  `${item_key}|${item_value}`;

function lookupRule(
  index: RulesetIndex,
  item_key: string,
  item_value: string
): { route: RouteAction; tier: SourceTier } | null {
  const key = ruleKey(item_key, item_value);
  for (const tier of TIER_ORDER) {
    const route = index[tier].get(key);
    if (route !== undefined) return { route, tier };
  }
  return null;
}

// Pure: given answers, a patient context, and a pre-narrowed index, returns
// patient_zone, staff_alert_level, and the list of rules that fired.
// `patient` is currently informational (the index is already narrowed at
// load time) but kept on the signature so callers can audit-log the context.
export function routeCheckIn(
  answers: CheckInAnswers,
  _patient: PatientRoutingContext,
  index: RulesetIndex
): RoutingResult {
  const lookups: Array<{ item_key: string; item_value: string }> = [
    { item_key: "pain", item_value: String(answers.pain) },
    {
      item_key: "light_sensitivity",
      item_value: String(answers.light_sensitivity),
    },
    { item_key: "vision", item_value: answers.vision },
    ...answers.unusual_symptoms.map((s) => ({
      item_key: `chip:${s}`,
      item_value: "true",
    })),
  ];

  const firing_rules: RuleHit[] = [];
  let maxStaff: RouteAction = "off";
  let maxPatient: "off" | "yellow" | "orange" = "off";

  for (const { item_key, item_value } of lookups) {
    const hit = lookupRule(index, item_key, item_value);
    if (!hit) continue;
    if (hit.route === "off") continue;

    firing_rules.push({
      item_key,
      item_value,
      route: hit.route,
      source_tier: hit.tier,
    });

    if (ROUTE_SEVERITY[hit.route] > ROUTE_SEVERITY[maxStaff]) {
      maxStaff = hit.route;
    }

    // Red collapses to orange for the patient view.
    const patientAction: "off" | "yellow" | "orange" =
      hit.route === "red" ? "orange" : hit.route;
    if (PATIENT_SEVERITY[patientAction] > PATIENT_SEVERITY[maxPatient]) {
      maxPatient = patientAction;
    }
  }

  return {
    patient_zone: maxPatient === "off" ? "green" : maxPatient,
    staff_alert_level: maxStaff === "off" ? "none" : maxStaff,
    firing_rules,
  };
}

// Loads all routing rulesets for the given patient context and buckets them
// into the four tiers. Each tier's Map is keyed by `item_key|item_value`.
// Last-write-wins inside a tier — uniqueness is also enforced at the DB
// level by the (ruleset_id, item_key, item_value) unique constraint plus
// the per-tier ruleset uniqueness on (procedure_type, surgeon_id).
export async function loadRulesetIndex(
  supabase: SupabaseClient<Database>,
  patient: PatientRoutingContext
): Promise<RulesetIndex> {
  const { data, error } = await supabase
    .from("routing_rulesets")
    .select(
      "procedure_type, surgeon_id, routing_rules(item_key, item_value, route)"
    );

  if (error) throw error;

  const buckets: Record<SourceTier, Map<string, RouteAction>> = {
    procedure_surgeon: new Map(),
    surgeon: new Map(),
    procedure: new Map(),
    default: new Map(),
  };

  for (const rs of data ?? []) {
    const tier = classifyRuleset(rs, patient);
    if (tier === null) continue;
    for (const rule of rs.routing_rules ?? []) {
      buckets[tier].set(ruleKey(rule.item_key, rule.item_value), rule.route);
    }
  }

  return buckets;
}

function classifyRuleset(
  rs: { procedure_type: string | null; surgeon_id: string | null },
  patient: PatientRoutingContext
): SourceTier | null {
  const pSpecific = patient.procedure_type !== null;
  const sSpecific = patient.surgeon_id !== null;

  if (
    pSpecific &&
    sSpecific &&
    rs.procedure_type === patient.procedure_type &&
    rs.surgeon_id === patient.surgeon_id
  ) {
    return "procedure_surgeon";
  }
  if (
    sSpecific &&
    rs.procedure_type === null &&
    rs.surgeon_id === patient.surgeon_id
  ) {
    return "surgeon";
  }
  if (
    pSpecific &&
    rs.procedure_type === patient.procedure_type &&
    rs.surgeon_id === null
  ) {
    return "procedure";
  }
  if (rs.procedure_type === null && rs.surgeon_id === null) {
    return "default";
  }
  return null; // ruleset is for a different procedure or surgeon
}

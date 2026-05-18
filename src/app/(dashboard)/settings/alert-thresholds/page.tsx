import { canEditRoutingRules, requireStaff } from "@/lib/require-staff";
import type { Database } from "@/types/database.types";
import { RulesEditor, type EditorGroup, type EditorRow } from "./RulesEditor";
import { AlertActionsPanel, type AlertActionRow } from "./AlertActionsPanel";

export const dynamic = "force-dynamic";

type RouteAction = Database["public"]["Enums"]["route_action"];
type Tier = "default" | "procedure" | "surgeon" | "procedure_surgeon";

const PROCEDURE_TYPES = ["lasik", "prk", "smile", "icl", "cataract"] as const;

type RulesetRow = {
  procedure_type: string | null;
  surgeon_id: string | null;
  routing_rules: Array<{
    item_key: string;
    item_value: string;
    route: RouteAction;
  }> | null;
};

function classifyForPatient(
  rs: { procedure_type: string | null; surgeon_id: string | null },
  patient: { procedure_type: string | null; surgeon_id: string | null }
): "procedure_surgeon" | "surgeon" | "procedure" | "default" | null {
  const pSpec = patient.procedure_type !== null;
  const sSpec = patient.surgeon_id !== null;
  if (
    pSpec &&
    sSpec &&
    rs.procedure_type === patient.procedure_type &&
    rs.surgeon_id === patient.surgeon_id
  )
    return "procedure_surgeon";
  if (sSpec && rs.procedure_type === null && rs.surgeon_id === patient.surgeon_id)
    return "surgeon";
  if (pSpec && rs.procedure_type === patient.procedure_type && rs.surgeon_id === null)
    return "procedure";
  if (rs.procedure_type === null && rs.surgeon_id === null) return "default";
  return null;
}

// Build a 4-tier index, optionally excluding the current tier ruleset
// (used to compute the "parent" effective rule per row).
function buildIndex(
  rulesets: RulesetRow[],
  patient: { procedure_type: string | null; surgeon_id: string | null },
  excludeExact: boolean
): Record<"procedure_surgeon" | "surgeon" | "procedure" | "default", Map<string, RouteAction>> {
  const buckets: Record<
    "procedure_surgeon" | "surgeon" | "procedure" | "default",
    Map<string, RouteAction>
  > = {
    procedure_surgeon: new Map(),
    surgeon: new Map(),
    procedure: new Map(),
    default: new Map(),
  };
  for (const rs of rulesets) {
    if (
      excludeExact &&
      rs.procedure_type === patient.procedure_type &&
      rs.surgeon_id === patient.surgeon_id
    ) {
      continue;
    }
    const tier = classifyForPatient(rs, patient);
    if (tier === null) continue;
    for (const rule of rs.routing_rules ?? []) {
      buckets[tier].set(`${rule.item_key}|${rule.item_value}`, rule.route);
    }
  }
  return buckets;
}

function effective(
  index: ReturnType<typeof buildIndex>,
  itemKey: string,
  itemValue: string
): RouteAction | null {
  const key = `${itemKey}|${itemValue}`;
  for (const tier of [
    "procedure_surgeon",
    "surgeon",
    "procedure",
    "default",
  ] as const) {
    const r = index[tier].get(key);
    if (r !== undefined) return r;
  }
  return null;
}

export default async function AlertThresholdsPage({
  searchParams,
}: {
  searchParams: {
    procedure?: string;
    surgeon?: string;
    saved?: string;
    error?: string;
  };
}) {
  const { supabase, staff } = await requireStaff();
  const canEdit = canEditRoutingRules(staff.role);

  const procedureType = searchParams.procedure?.trim() || null;
  const surgeonId = searchParams.surgeon?.trim() || null;
  const patient = { procedure_type: procedureType, surgeon_id: surgeonId };

  const tier: Tier =
    procedureType && surgeonId
      ? "procedure_surgeon"
      : procedureType
        ? "procedure"
        : surgeonId
          ? "surgeon"
          : "default";

  const [rulesetsResult, surgeonsResult, symptomsResult, actionsResult] =
    await Promise.all([
      supabase
        .from("routing_rulesets")
        .select(
          "procedure_type, surgeon_id, routing_rules(item_key, item_value, route)"
        ),
      supabase
        .from("staff_users")
        .select("id, name")
        .eq("role", "surgeon")
        .order("name"),
      supabase
        .from("symptom_options")
        .select("key, label")
        .eq("active", true)
        .order("order_index"),
      supabase.from("zone_alert_actions").select("*"),
    ]);

  const rulesets = (rulesetsResult.data ?? []) as RulesetRow[];
  const surgeons = surgeonsResult.data ?? [];
  const symptoms = symptomsResult.data ?? [];

  // Override-rule counts per procedure / surgeon, for the picker badges.
  const procedureOverrideCounts: Record<string, number> = {};
  const surgeonOverrideCounts: Record<string, number> = {};
  for (const rs of rulesets) {
    const n = (rs.routing_rules ?? []).length;
    if (n === 0) continue;
    if (rs.procedure_type)
      procedureOverrideCounts[rs.procedure_type] =
        (procedureOverrideCounts[rs.procedure_type] ?? 0) + n;
    if (rs.surgeon_id)
      surgeonOverrideCounts[rs.surgeon_id] =
        (surgeonOverrideCounts[rs.surgeon_id] ?? 0) + n;
  }

  const surgeonLabel = surgeons.find((s) => s.id === surgeonId)?.name ?? null;
  const procedureLabel = procedureType ? procedureType.toUpperCase() : null;

  const currentIndex = buildIndex(rulesets, patient, false);
  const parentIndex = buildIndex(rulesets, patient, true);

  function rowFor(itemKey: string, itemValue: string, label: string): EditorRow {
    const current = effective(currentIndex, itemKey, itemValue) ?? "off";
    const parent =
      tier === "default" ? null : effective(parentIndex, itemKey, itemValue);
    return {
      itemKey,
      itemValue,
      label,
      currentRoute: current,
      parentRoute: parent ?? null,
    };
  }

  const groups: EditorGroup[] = [
    {
      kind: "level",
      title: "Eye pain level",
      subtitle: "Patient picks 0–5",
      rows: [0, 1, 2, 3, 4, 5].map((n) =>
        rowFor("pain", String(n), `Pain ${n}`)
      ),
    },
    {
      kind: "level",
      title: "Light sensitivity",
      subtitle: "Patient picks 0–5",
      rows: [0, 1, 2, 3, 4, 5].map((n) =>
        rowFor("light_sensitivity", String(n), `Light sensitivity ${n}`)
      ),
    },
    {
      kind: "vision",
      title: "Vision compared to yesterday",
      subtitle: "Patient picks one",
      rows: [
        rowFor("vision", "better", "Better"),
        rowFor("vision", "same", "Same"),
        rowFor("vision", "worse", "Worse"),
      ],
    },
    {
      kind: "symptoms",
      title: "Unusual symptoms",
      subtitle: "Chips the patient can tap",
      rows: symptoms.map((s) => rowFor(`chip:${s.key}`, "true", s.label)),
    },
  ];

  const alertActions = (actionsResult.data ?? []) as AlertActionRow[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <header>
        <h2 className="text-xl font-semibold text-fv-text-primary">
          Daily check-in routing rules
        </h2>
        <p className="mt-1 text-[13px] text-fv-text-secondary">
          Configure how each daily check-in answer maps to a zone. Rules can be
          customised by procedure AND by surgeon — pick a combination below.
          Most clinics start with the Default ruleset and only deviate for
          procedures (or surgeons) where the expected recovery pattern is
          different.
        </p>
      </header>

      {searchParams.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <RulesEditor
        procedureType={procedureType}
        surgeonId={surgeonId}
        procedureOptions={[...PROCEDURE_TYPES]}
        surgeonOptions={surgeons}
        procedureOverrideCounts={procedureOverrideCounts}
        surgeonOverrideCounts={surgeonOverrideCounts}
        groups={groups}
        tier={tier}
        procedureLabel={procedureLabel}
        surgeonLabel={surgeonLabel}
        saved={searchParams.saved === "1"}
        canEdit={canEdit}
      />

      <AlertActionsPanel rows={alertActions} />
    </main>
  );
}

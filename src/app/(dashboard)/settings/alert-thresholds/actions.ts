"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";
import type { Database } from "@/types/database.types";

type RouteAction = Database["public"]["Enums"]["route_action"];

const ROUTE_ACTIONS: ReadonlyArray<RouteAction> = [
  "off",
  "yellow",
  "orange",
  "red",
];

function back(qs: URLSearchParams, message: string): never {
  qs.set("error", message);
  redirect(`/settings/alert-thresholds?${qs.toString()}`);
}

function rulesetName(
  procedureType: string | null,
  surgeonName: string | null
): string {
  if (!procedureType && !surgeonName) return "Default";
  if (procedureType && !surgeonName) return procedureType.toUpperCase();
  if (!procedureType && surgeonName) return surgeonName;
  return `${procedureType?.toUpperCase()} × ${surgeonName}`;
}

// Persists routing-rule overrides for the chosen (procedure × surgeon)
// scope. For each submitted rule:
//   - if the new value equals the parent-tier value, no override is
//     stored (and any existing override at this tier is removed);
//   - if it differs, an override row is upserted in this tier's ruleset.
// The tier's ruleset is created lazily if it doesn't exist yet.
export async function saveRoutingRulesAction(formData: FormData) {
  const procedureType =
    String(formData.get("procedure_type") ?? "").trim() || null;
  const surgeonId =
    String(formData.get("surgeon_id") ?? "").trim() || null;

  const qs = new URLSearchParams();
  if (procedureType) qs.set("procedure", procedureType);
  if (surgeonId) qs.set("surgeon", surgeonId);

  const { supabase } = await requireStaff();

  // Collect all rule:* fields posted from the form.
  // Field name format: route:<item_key>:<item_value>
  const submitted = new Map<string, RouteAction>(); // key="item_key|item_value"
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("route:")) continue;
    const rest = name.slice("route:".length);
    const lastColon = rest.lastIndexOf(":");
    if (lastColon < 0) continue;
    const itemKey = rest.slice(0, lastColon);
    const itemValue = rest.slice(lastColon + 1);
    const v = String(value);
    if (!(ROUTE_ACTIONS as ReadonlyArray<string>).includes(v)) continue;
    submitted.set(`${itemKey}|${itemValue}`, v as RouteAction);
  }

  // The parent-tier value per rule is encoded in hidden fields as
  // parent:<item_key>:<item_value> = <route>|empty. If empty, no parent
  // value exists (this is the Default tier, or no rule at any parent).
  const parents = new Map<string, RouteAction | null>();
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("parent:")) continue;
    const rest = name.slice("parent:".length);
    const lastColon = rest.lastIndexOf(":");
    if (lastColon < 0) continue;
    const itemKey = rest.slice(0, lastColon);
    const itemValue = rest.slice(lastColon + 1);
    const v = String(value);
    parents.set(
      `${itemKey}|${itemValue}`,
      (ROUTE_ACTIONS as ReadonlyArray<string>).includes(v)
        ? (v as RouteAction)
        : null
    );
  }

  // Resolve surgeon name (for the auto-generated ruleset name).
  let surgeonName: string | null = null;
  if (surgeonId) {
    const { data: surgeon } = await supabase
      .from("staff_users")
      .select("name")
      .eq("id", surgeonId)
      .maybeSingle();
    surgeonName = surgeon?.name ?? null;
  }

  // Ensure the ruleset for this tier exists. Filtering on nullable
  // columns via supabase-js builder is awkward, so just fetch all and
  // match in-memory.
  const { data: allRulesets } = await supabase
    .from("routing_rulesets")
    .select("id, procedure_type, surgeon_id");
  let rulesetId = (allRulesets ?? []).find(
    (rs) => rs.procedure_type === procedureType && rs.surgeon_id === surgeonId
  )?.id;

  if (!rulesetId) {
    const { data: created, error: createError } = await supabase
      .from("routing_rulesets")
      .insert({
        name: rulesetName(procedureType, surgeonName),
        procedure_type: procedureType,
        surgeon_id: surgeonId,
      })
      .select("id")
      .single();
    if (createError) back(qs, createError.message);
    rulesetId = created!.id;
  }

  // For each submitted rule, compare to parent and persist a diff.
  // Track changes for the audit log.
  const changes: Array<{
    rule_key: string;
    rule_value: string;
    from: RouteAction | null;
    to: RouteAction | null;
  }> = [];

  for (const [key, value] of submitted.entries()) {
    const [itemKey, itemValue] = key.split("|");
    if (!itemKey || itemValue === undefined) continue;
    const parentValue = parents.get(key) ?? null;

    // Read existing override (if any) at this tier.
    const { data: existing } = await supabase
      .from("routing_rules")
      .select("id, route")
      .eq("ruleset_id", rulesetId!)
      .eq("item_key", itemKey)
      .eq("item_value", itemValue)
      .maybeSingle();

    if (parentValue !== null && value === parentValue) {
      // Same as parent → no override needed. Remove any existing.
      if (existing) {
        await supabase
          .from("routing_rules")
          .delete()
          .eq("id", existing.id);
        changes.push({
          rule_key: itemKey,
          rule_value: itemValue,
          from: existing.route as RouteAction,
          to: null,
        });
      }
    } else {
      // Different from parent (or no parent — this IS the default tier)
      // → upsert override at this tier.
      if (existing) {
        if (existing.route !== value) {
          await supabase
            .from("routing_rules")
            .update({ route: value })
            .eq("id", existing.id);
          changes.push({
            rule_key: itemKey,
            rule_value: itemValue,
            from: existing.route as RouteAction,
            to: value,
          });
        }
      } else {
        await supabase.from("routing_rules").insert({
          ruleset_id: rulesetId!,
          item_key: itemKey,
          item_value: itemValue,
          route: value,
        });
        changes.push({
          rule_key: itemKey,
          rule_value: itemValue,
          from: null,
          to: value,
        });
      }
    }
  }

  if (changes.length > 0) {
    await recordStaffAudit(supabase, "settings.routing_rules_updated", {
      entity_type: "routing_ruleset",
      entity_id: rulesetId!,
      new_value: {
        procedure_type: procedureType,
        surgeon_id: surgeonId,
        change_count: changes.length,
        changes: changes.slice(0, 50), // cap to keep audit row reasonable
      },
    });
  }

  revalidatePath("/settings/alert-thresholds");
  redirect(`/settings/alert-thresholds?${qs.toString()}&saved=1`);
}

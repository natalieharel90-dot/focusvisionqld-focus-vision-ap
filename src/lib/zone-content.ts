// Recovery-guidance content lookup for the patient app result screen.
// Uses the same 4-tier most-specific-wins fallback as the routing engine
// in lib/zones.ts: (zone × procedure × surgeon) → surgeon-only →
// procedure-only → default. Wildcard rows store NULL in procedure_type
// and/or surgeon_id.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { PatientZone } from "./zones";

export type ZoneContentRow =
  Database["public"]["Tables"]["zone_content"]["Row"];

type ZoneContentQuery = {
  zone: PatientZone;
  procedure_type: string | null;
  surgeon_id: string | null;
};

type Tier = "procedure_surgeon" | "surgeon" | "procedure" | "default";

const TIER_ORDER: ReadonlyArray<Tier> = [
  "procedure_surgeon",
  "surgeon",
  "procedure",
  "default",
];

function classify(
  row: ZoneContentRow,
  q: ZoneContentQuery
): Tier | null {
  const pSpecific = q.procedure_type !== null;
  const sSpecific = q.surgeon_id !== null;
  if (
    pSpecific &&
    sSpecific &&
    row.procedure_type === q.procedure_type &&
    row.surgeon_id === q.surgeon_id
  ) {
    return "procedure_surgeon";
  }
  if (sSpecific && row.procedure_type === null && row.surgeon_id === q.surgeon_id) {
    return "surgeon";
  }
  if (pSpecific && row.procedure_type === q.procedure_type && row.surgeon_id === null) {
    return "procedure";
  }
  if (row.procedure_type === null && row.surgeon_id === null) {
    return "default";
  }
  return null;
}

export async function loadZoneContent(
  supabase: SupabaseClient<Database>,
  query: ZoneContentQuery
): Promise<ZoneContentRow | null> {
  const { data, error } = await supabase
    .from("zone_content")
    .select("*")
    .eq("zone", query.zone);
  if (error) throw error;

  const buckets = new Map<Tier, ZoneContentRow>();
  for (const row of data ?? []) {
    const tier = classify(row, query);
    if (tier !== null && !buckets.has(tier)) buckets.set(tier, row);
  }
  for (const tier of TIER_ORDER) {
    const row = buckets.get(tier);
    if (row) return row;
  }
  return null;
}

// Recovery-guidance content lookup + merge.
//
// zone_content rows form a 4-tier hierarchy per zone:
//   (zone × procedure × surgeon) → surgeon-only → procedure-only →
//   default. Wildcard rows store NULL in procedure_type / surgeon_id.
//
// Fallback is PER FIELD, not per row: a surgeon-specific Yellow row can
// override just the headline and leave message / symptoms / tip NULL,
// inheriting those from the procedure default (or the global default).
// The Default tier always has every field populated, so the merge
// always resolves to a complete set of content.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { PatientZone } from "./zones";

// Banner shown at the top of the Recovery guidance editor, mirroring the
// prototype's reminder. Exported so it has a single source of truth.
export const PLACEHOLDER_WARNING =
  "The text in these fields is placeholder content written during prototyping. Before any real patient sees the app, your clinical team needs to replace it with content the surgeons and optometrists have signed off — run a one-hour content workshop to capture the actual wording.";

export type ZoneContentFields = {
  headline: string | null;
  message: string | null;
  expected_symptoms: string[] | null;
  today_tip: string | null;
  instructions: string | null;
  warning: string | null;
};

export type ZoneContentScopedRow = ZoneContentFields & {
  procedure_type: string | null;
  surgeon_id: string | null;
};

export type ZoneContentQuery = {
  zone: PatientZone;
  procedure_type: string | null;
  surgeon_id: string | null;
};

export type SourceTier =
  | "procedure_surgeon"
  | "surgeon"
  | "procedure"
  | "default";

const TIER_ORDER: ReadonlyArray<SourceTier> = [
  "procedure_surgeon",
  "surgeon",
  "procedure",
  "default",
];

const CONTENT_KEYS: ReadonlyArray<keyof ZoneContentFields> = [
  "headline",
  "message",
  "expected_symptoms",
  "today_tip",
  "instructions",
  "warning",
];

export function classifyZoneRow(
  row: { procedure_type: string | null; surgeon_id: string | null },
  query: Pick<ZoneContentQuery, "procedure_type" | "surgeon_id">
): SourceTier | null {
  const pSpecific = query.procedure_type !== null;
  const sSpecific = query.surgeon_id !== null;
  if (
    pSpecific &&
    sSpecific &&
    row.procedure_type === query.procedure_type &&
    row.surgeon_id === query.surgeon_id
  ) {
    return "procedure_surgeon";
  }
  if (
    sSpecific &&
    row.procedure_type === null &&
    row.surgeon_id === query.surgeon_id
  ) {
    return "surgeon";
  }
  if (
    pSpecific &&
    row.procedure_type === query.procedure_type &&
    row.surgeon_id === null
  ) {
    return "procedure";
  }
  if (row.procedure_type === null && row.surgeon_id === null) {
    return "default";
  }
  return null;
}

// Bucket scoped rows into the 4 tiers (one row per tier). `excludeExact`
// drops the row matching the exact (procedure × surgeon) scope — used by
// the editor to compute the parent (next-level-up) merge.
export function bucketZoneRows(
  rows: ReadonlyArray<ZoneContentScopedRow>,
  query: Pick<ZoneContentQuery, "procedure_type" | "surgeon_id">,
  excludeExact = false
): Record<SourceTier, ZoneContentFields | null> {
  const buckets: Record<SourceTier, ZoneContentFields | null> = {
    procedure_surgeon: null,
    surgeon: null,
    procedure: null,
    default: null,
  };
  for (const row of rows) {
    if (
      excludeExact &&
      row.procedure_type === query.procedure_type &&
      row.surgeon_id === query.surgeon_id
    ) {
      continue;
    }
    const tier = classifyZoneRow(row, query);
    if (tier !== null && buckets[tier] === null) {
      buckets[tier] = {
        headline: row.headline,
        message: row.message,
        expected_symptoms: row.expected_symptoms,
        today_tip: row.today_tip,
        instructions: row.instructions,
        warning: row.warning,
      };
    }
  }
  return buckets;
}

// Per-field merge: for each field, take the first non-null value walking
// most-specific → least. Returns null only if no tier has any row.
export function mergeZoneFields(
  buckets: Record<SourceTier, ZoneContentFields | null>
): ZoneContentFields | null {
  const ordered = TIER_ORDER.map((t) => buckets[t]);
  if (ordered.every((b) => b === null)) return null;

  const merged: ZoneContentFields = {
    headline: null,
    message: null,
    expected_symptoms: null,
    today_tip: null,
    instructions: null,
    warning: null,
  };
  for (const key of CONTENT_KEYS) {
    for (const bucket of ordered) {
      if (bucket && bucket[key] != null) {
        // @ts-expect-error — key/value indexed in lockstep.
        merged[key] = bucket[key];
        break;
      }
    }
  }
  return merged;
}

function textEqual(a: string | null, b: string | null): boolean {
  return (a ?? "").trim() === (b ?? "").trim();
}

function symptomsEqual(
  a: string[] | null,
  b: string[] | null
): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  return aa.every((v, i) => v.trim() === (bb[i] ?? "").trim());
}

// Given the editor's values and the merged parent (next-level-up) values,
// compute what to persist at this tier: a field equal to the parent is
// stored as NULL (inherited). `allInherited` true ⇒ the whole row is
// redundant and should not be written (the parent already applies).
//
// parent === null means this IS the Default tier — everything is stored.
export function computeZoneContentDiff(
  editor: ZoneContentFields,
  parent: ZoneContentFields | null
): { stored: ZoneContentFields; allInherited: boolean } {
  if (parent === null) {
    return { stored: editor, allInherited: false };
  }
  const stored: ZoneContentFields = {
    headline: textEqual(editor.headline, parent.headline)
      ? null
      : editor.headline,
    message: textEqual(editor.message, parent.message)
      ? null
      : editor.message,
    expected_symptoms: symptomsEqual(
      editor.expected_symptoms,
      parent.expected_symptoms
    )
      ? null
      : editor.expected_symptoms,
    today_tip: textEqual(editor.today_tip, parent.today_tip)
      ? null
      : editor.today_tip,
    instructions: textEqual(editor.instructions, parent.instructions)
      ? null
      : editor.instructions,
    warning: textEqual(editor.warning, parent.warning)
      ? null
      : editor.warning,
  };
  const allInherited = CONTENT_KEYS.every((k) => stored[k] === null);
  return { stored, allInherited };
}

// Patient-side lookup: reads the public view (RLS-free guidance content),
// buckets by tier, and merges per field.
export async function loadZoneContent(
  supabase: SupabaseClient<Database>,
  query: ZoneContentQuery
): Promise<ZoneContentFields | null> {
  const { data, error } = await supabase
    .from("public_zone_content")
    .select(
      "zone, procedure_type, surgeon_id, headline, message, expected_symptoms, today_tip, instructions, warning"
    )
    .eq("zone", query.zone);
  if (error) throw error;

  const rows: ZoneContentScopedRow[] = (data ?? []).map((r) => ({
    procedure_type: r.procedure_type,
    surgeon_id: r.surgeon_id,
    headline: r.headline,
    message: r.message,
    expected_symptoms: r.expected_symptoms,
    today_tip: r.today_tip,
    instructions: r.instructions,
    warning: r.warning,
  }));

  return mergeZoneFields(bucketZoneRows(rows, query));
}

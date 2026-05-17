"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/require-staff";
import {
  bucketZoneRows,
  computeZoneContentDiff,
  mergeZoneFields,
  type ZoneContentFields,
  type ZoneContentScopedRow,
} from "@/lib/zone-content";
import type { Database } from "@/types/database.types";

type PatientZone = Database["public"]["Enums"]["patient_zone"];
const ZONES: ReadonlyArray<PatientZone> = ["green", "yellow", "orange"];

function buildQs(
  procedureType: string | null,
  surgeonId: string | null
): URLSearchParams {
  const qs = new URLSearchParams();
  if (procedureType) qs.set("procedure", procedureType);
  if (surgeonId) qs.set("surgeon", surgeonId);
  return qs;
}

function back(qs: URLSearchParams, message: string): never {
  qs.set("error", message);
  redirect(`/settings/recovery-guidance?${qs.toString()}`);
}

// Splits a textarea (one item per line) into a trimmed string array.
function linesToArray(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export async function saveZoneContentAction(formData: FormData) {
  const zone = String(formData.get("zone") ?? "") as PatientZone;
  const procedureType =
    String(formData.get("procedure_type") ?? "").trim() || null;
  const surgeonId =
    String(formData.get("surgeon_id") ?? "").trim() || null;
  const qs = buildQs(procedureType, surgeonId);

  if (!ZONES.includes(zone)) back(qs, "Invalid zone.");

  const editor: ZoneContentFields = {
    headline: String(formData.get("headline") ?? "").trim() || null,
    message: String(formData.get("message") ?? "").trim() || null,
    expected_symptoms: linesToArray(
      String(formData.get("expected_symptoms") ?? "")
    ),
    today_tip: String(formData.get("today_tip") ?? "").trim() || null,
    instructions: String(formData.get("instructions") ?? "").trim() || null,
    warning: String(formData.get("warning") ?? "").trim() || null,
  };

  const { supabase, userId } = await requireStaff();

  const isDefaultTier = procedureType === null && surgeonId === null;

  // Recompute the parent (next-level-up) merge server-side rather than
  // trusting client-supplied values.
  const { data: existingRows } = await supabase
    .from("zone_content")
    .select(
      "procedure_type, surgeon_id, headline, message, expected_symptoms, today_tip, instructions, warning"
    )
    .eq("zone", zone);
  const rows = (existingRows ?? []) as ZoneContentScopedRow[];

  const query = { procedure_type: procedureType, surgeon_id: surgeonId };
  const parent = isDefaultTier
    ? null
    : mergeZoneFields(bucketZoneRows(rows, query, true));

  const { stored, allInherited } = computeZoneContentDiff(editor, parent);

  if (allInherited) {
    // Identical to the parent — no row should exist at this tier.
    await supabase
      .from("zone_content")
      .delete()
      .eq("zone", zone)
      .match({
        procedure_type: procedureType,
        surgeon_id: surgeonId,
      });
  } else {
    const { error } = await supabase
      .from("zone_content")
      .upsert(
        {
          zone,
          procedure_type: procedureType,
          surgeon_id: surgeonId,
          headline: stored.headline,
          message: stored.message,
          expected_symptoms: stored.expected_symptoms,
          today_tip: stored.today_tip,
          instructions: stored.instructions,
          warning: stored.warning,
          updated_by: userId,
        },
        { onConflict: "zone,procedure_type,surgeon_id" }
      );
    if (error) back(qs, error.message);
  }

  await recordStaffAudit(supabase, "settings.recovery_guidance_updated", {
    entity_type: "zone_content",
    entity_id: null,
    new_value: {
      zone,
      procedure_type: procedureType,
      surgeon_id: surgeonId,
      all_inherited: allInherited,
    },
  });

  revalidatePath("/settings/recovery-guidance");
  qs.set("saved", zone);
  redirect(`/settings/recovery-guidance?${qs.toString()}`);
}

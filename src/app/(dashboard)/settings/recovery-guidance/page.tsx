import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  bucketZoneRows,
  mergeZoneFields,
  type ZoneContentFields,
  type ZoneContentScopedRow,
} from "@/lib/zone-content";
import type { Database } from "@/types/database.types";
import { RecoveryGuidanceEditor } from "./RecoveryGuidanceEditor";

export const dynamic = "force-dynamic";

type PatientZone = Database["public"]["Enums"]["patient_zone"];
const ZONES: ReadonlyArray<PatientZone> = ["green", "yellow", "orange"];
const PROCEDURE_TYPES = ["lasik", "prk", "smile", "icl", "cataract"];

const EMPTY: ZoneContentFields = {
  headline: null,
  message: null,
  expected_symptoms: null,
  today_tip: null,
  instructions: null,
  warning: null,
};

export default async function RecoveryGuidancePage({
  searchParams,
}: {
  searchParams: { procedure?: string; surgeon?: string; saved?: string; error?: string };
}) {
  const supabase = createSupabaseServerClient();

  const procedureType = searchParams.procedure?.trim() || null;
  const surgeonId = searchParams.surgeon?.trim() || null;
  const query = { procedure_type: procedureType, surgeon_id: surgeonId };

  const tier =
    procedureType && surgeonId
      ? "procedure_surgeon"
      : procedureType
        ? "procedure"
        : surgeonId
          ? "surgeon"
          : "default";

  const [zoneRowsResult, surgeonsResult] = await Promise.all([
    supabase
      .from("zone_content")
      .select(
        "zone, procedure_type, surgeon_id, headline, message, expected_symptoms, today_tip, instructions, warning"
      ),
    supabase
      .from("staff_users")
      .select("id, name")
      .eq("role", "surgeon")
      .order("name"),
  ]);

  const allRows = zoneRowsResult.data ?? [];
  const surgeons = surgeonsResult.data ?? [];

  // For each zone, compute the effective (merged) content at this tier —
  // that's what the editor shows the staff member.
  const zoneContent: Record<PatientZone, ZoneContentFields> = {
    green: EMPTY,
    yellow: EMPTY,
    orange: EMPTY,
  };
  for (const zone of ZONES) {
    const rowsForZone: ZoneContentScopedRow[] = allRows
      .filter((r) => r.zone === zone)
      .map((r) => ({
        procedure_type: r.procedure_type,
        surgeon_id: r.surgeon_id,
        headline: r.headline,
        message: r.message,
        expected_symptoms: r.expected_symptoms,
        today_tip: r.today_tip,
        instructions: r.instructions,
        warning: r.warning,
      }));
    zoneContent[zone] =
      mergeZoneFields(bucketZoneRows(rowsForZone, query)) ?? EMPTY;
  }

  return (
    <RecoveryGuidanceEditor
      procedureType={procedureType}
      surgeonId={surgeonId}
      procedureOptions={PROCEDURE_TYPES}
      surgeonOptions={surgeons}
      tier={tier}
      procedureLabel={procedureType ? procedureType.toUpperCase() : null}
      surgeonLabel={
        surgeons.find((s) => s.id === surgeonId)?.name ?? null
      }
      green={zoneContent.green}
      yellow={zoneContent.yellow}
      orange={zoneContent.orange}
      savedZone={searchParams.saved ?? null}
      error={searchParams.error ?? null}
    />
  );
}

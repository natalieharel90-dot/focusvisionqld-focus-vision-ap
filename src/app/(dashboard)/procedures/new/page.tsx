import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { TemplateEditor } from "../TemplateEditor";

export const dynamic = "force-dynamic";

const PROCEDURE_TYPES = ["lasik", "prk", "smile", "icl", "cataract"];

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: { surgeon?: string; procedure?: string; error?: string };
}) {
  const surgeonId = searchParams.surgeon?.trim();
  const procedureType = searchParams.procedure?.trim();

  if (
    !surgeonId ||
    !procedureType ||
    !PROCEDURE_TYPES.includes(procedureType)
  ) {
    // New templates are always created from a specific grid cell.
    notFound();
  }

  const supabase = createSupabaseServerClient();

  const [surgeonResult, rulesetsResult, existingResult] = await Promise.all([
    supabase
      .from("staff_users")
      .select("name")
      .eq("id", surgeonId)
      .maybeSingle(),
    supabase.from("routing_rulesets").select("id, name").order("name"),
    // Guard against a duplicate — one template per (surgeon × procedure).
    supabase
      .from("procedure_templates")
      .select("id")
      .eq("surgeon_id", surgeonId)
      .eq("procedure_type", procedureType)
      .is("archived_at", null)
      .maybeSingle(),
  ]);

  if (!surgeonResult.data) notFound();
  if (existingResult.data) {
    // Template already exists — fall through to the editor instead.
    const { redirect } = await import("next/navigation");
    redirect(`/procedures/${existingResult.data.id}`);
  }

  return (
    <TemplateEditor
      templateId={null}
      surgeonId={surgeonId}
      surgeonName={surgeonResult.data.name}
      procedureType={procedureType}
      initialMedications={[]}
      initialAppointments={[]}
      linkedRoutingRulesetId={null}
      rulesetOptions={rulesetsResult.data ?? []}
      saved={false}
      error={searchParams.error ?? null}
    />
  );
}

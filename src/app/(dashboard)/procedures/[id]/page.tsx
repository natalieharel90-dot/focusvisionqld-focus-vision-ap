import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  parseTemplateAppointments,
  parseTemplateMedications,
} from "@/lib/templates";
import { TemplateEditor } from "../TemplateEditor";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string; error?: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: template } = await supabase
    .from("procedure_templates")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!template) notFound();

  const [surgeonResult, rulesetsResult] = await Promise.all([
    supabase
      .from("staff_users")
      .select("name")
      .eq("id", template.surgeon_id)
      .maybeSingle(),
    supabase.from("routing_rulesets").select("id, name").order("name"),
  ]);

  return (
    <TemplateEditor
      templateId={template.id}
      surgeonId={template.surgeon_id}
      surgeonName={surgeonResult.data?.name ?? "Unknown surgeon"}
      procedureType={template.procedure_type}
      initialMedications={parseTemplateMedications(
        template.default_medications
      )}
      initialAppointments={parseTemplateAppointments(
        template.default_appointments
      )}
      linkedRoutingRulesetId={template.linked_routing_ruleset_id}
      rulesetOptions={rulesetsResult.data ?? []}
      saved={searchParams.saved === "1"}
      error={searchParams.error ?? null}
    />
  );
}

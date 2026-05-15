"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordStaffAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isReportType, type ReportType } from "@/lib/reports";
import type { Json } from "@/types/database.types";

// Reports are tier-1/tier-2 only; Reception (tier 3) is denied — enforced
// server-side here as well as in the page.
async function requireReportAccess() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: me } = await supabase
    .from("staff_users")
    .select("access_tier")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.access_tier !== 1 && me?.access_tier !== 2) {
    redirect("/reports?error=You+do+not+have+access+to+reports.");
  }
  return { supabase, userId: user.id };
}

// Builds the parameters object for a report type from the submitted form.
function readParameters(
  type: ReportType,
  formData: FormData
): Record<string, unknown> {
  const str = (k: string) => String(formData.get(k) ?? "").trim() || undefined;
  switch (type) {
    case "monthly_activity":
      return { month: str("month") };
    case "surgeon":
      return {
        surgeonId: str("surgeonId"),
        from: str("from"),
        to: str("to"),
      };
    case "compliance":
      return { from: str("from"), to: str("to") };
    case "cohort":
      return {
        procedures: formData.getAll("procedures").map(String),
        surgeonIds: formData.getAll("surgeonIds").map(String),
        from: str("from"),
        to: str("to"),
        zone: str("zone"),
      };
  }
}

export async function generateReportAction(formData: FormData) {
  const type = String(formData.get("report_type") ?? "");
  if (!isReportType(type)) redirect("/reports?error=Unknown+report+type.");

  const { supabase, userId } = await requireReportAccess();
  const includeIdentifiers = formData.get("include_identifiers") != null;
  const parameters = readParameters(type as ReportType, formData);

  const { data: row, error } = await supabase
    .from("generated_reports")
    .insert({
      report_type: type,
      parameters: parameters as unknown as Json,
      include_identifiers: includeIdentifiers,
      generated_by_staff_id: userId,
    })
    .select("id")
    .single();
  if (error || !row) {
    redirect(
      `/reports?type=${type}&error=${encodeURIComponent(
        error?.message ?? "Could not create the report."
      )}`
    );
  }

  await recordStaffAudit(supabase, "report.generated", {
    entity_type: "generated_report",
    entity_id: row.id,
    new_value: {
      report_type: type,
      include_identifiers: includeIdentifiers,
      parameters,
    } as unknown as Json,
  });

  redirect(`/reports/${row.id}`);
}

// Toggles the monthly auto-generation schedule for a report type.
export async function setReportScheduleAction(formData: FormData) {
  const type = String(formData.get("report_type") ?? "");
  if (!isReportType(type)) redirect("/reports?error=Unknown+report+type.");

  const { supabase, userId } = await requireReportAccess();
  const enabled = formData.get("enabled") != null;
  const includeIdentifiers = formData.get("include_identifiers") != null;
  const parameters = readParameters(type as ReportType, formData);

  const { error } = await supabase.from("report_schedules").upsert(
    {
      report_type: type,
      enabled,
      include_identifiers: includeIdentifiers,
      parameters: parameters as unknown as Json,
      updated_by: userId,
    },
    { onConflict: "report_type" }
  );
  if (error) {
    redirect(`/reports?type=${type}&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/reports");
  redirect(`/reports?type=${type}`);
}

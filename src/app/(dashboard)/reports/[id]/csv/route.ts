import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ReportType } from "@/lib/reports";
import { buildReport } from "../../builders";

// CSV download for a generated report. Tier-1/2 only — Reception (tier 3)
// is denied, matching the report page + actions.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { data: me } = await supabase
    .from("staff_users")
    .select("access_tier")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.access_tier !== 1 && me?.access_tier !== 2) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: report } = await supabase
    .from("generated_reports")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!report) {
    return new NextResponse("Not found", { status: 404 });
  }

  let data = report.data as Record<string, unknown> | null;
  if (!data) {
    data = await buildReport(
      supabase,
      report.report_type as ReportType,
      (report.parameters as Record<string, unknown>) ?? {},
      report.include_identifiers,
      new Date(report.generated_at)
    );
    await supabase
      .from("generated_reports")
      .update({ data: data as never })
      .eq("id", report.id);
  }

  const rows = toRows(report.report_type as ReportType, data);
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const date = report.generated_at.slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.report_type}-${date}.csv"`,
    },
  });
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Each report type flattens to its own CSV layout: a metrics block for the
// scalar reports, a per-row table for cohort.
function toRows(type: ReportType, data: Record<string, unknown>): unknown[][] {
  switch (type) {
    case "monthly_activity": {
      const d = data as {
        period: { label: string };
        onboarded: { count: number };
        checkIns: {
          completed: number;
          expected: number;
          completionPct: number;
          zones: Record<string, number>;
        };
        adherencePct: number | null;
        messages: {
          fromPatients: number;
          fromStaff: number;
          medianResponse: string;
        };
        flags: {
          count: number;
          byLevel: Record<string, number>;
          avgResolutionHours: number | null;
        };
      };
      return [
        ["Metric", "Value"],
        ["Period", d.period.label],
        ["Patients onboarded", d.onboarded.count],
        ["Check-ins completed", d.checkIns.completed],
        ["Check-ins expected", d.checkIns.expected],
        ["Completion %", d.checkIns.completionPct],
        ["Zone green", d.checkIns.zones.green],
        ["Zone yellow", d.checkIns.zones.yellow],
        ["Zone orange", d.checkIns.zones.orange],
        ["Zone red", d.checkIns.zones.red],
        ["Adherence %", d.adherencePct ?? "n/a"],
        ["Messages from patients", d.messages.fromPatients],
        ["Messages from staff", d.messages.fromStaff],
        ["Median response", d.messages.medianResponse],
        ["Flags raised", d.flags.count],
        ["Flags yellow", d.flags.byLevel.yellow ?? 0],
        ["Flags orange", d.flags.byLevel.orange ?? 0],
        ["Flags red", d.flags.byLevel.red ?? 0],
        ["Avg resolution (h)", d.flags.avgResolutionHours ?? "n/a"],
      ];
    }
    case "surgeon": {
      const d = data as {
        period: { label: string };
        surgeon: string;
        patientCount: number;
        adherencePct: number | null;
        zones: Record<string, number>;
        medianResponse: string;
        flagRatePer100: number;
        flaggedPatients: {
          displayName: string;
          recoveryDay: number | null;
          level: string;
          outcome: string;
        }[];
      };
      return [
        ["Metric", "Value"],
        ["Surgeon", d.surgeon],
        ["Period", d.period.label],
        ["Patients", d.patientCount],
        ["Adherence %", d.adherencePct ?? "n/a"],
        ["Median response", d.medianResponse],
        ["Flag rate per 100 recovery-days", d.flagRatePer100],
        ["Zone green", d.zones.green],
        ["Zone yellow", d.zones.yellow],
        ["Zone orange", d.zones.orange],
        ["Zone red", d.zones.red],
        [],
        ["Flagged patient", "Recovery day", "Level", "Outcome"],
        ...d.flaggedPatients.map((p) => [
          p.displayName,
          p.recoveryDay ?? "",
          p.level,
          p.outcome,
        ]),
      ];
    }
    case "compliance": {
      const d = data as {
        period: { label: string };
        recordEditsByStaff: Record<string, number>;
        adminActions: Record<string, number>;
        exports: { event: string; actor: string; at: string }[];
      };
      return [
        ["Compliance summary", d.period.label],
        [],
        ["Record edits — staff", "Count"],
        ...Object.entries(d.recordEditsByStaff),
        [],
        ["Admin action", "Count"],
        ...Object.entries(d.adminActions),
        [],
        ["Export event", "Actor", "At"],
        ...d.exports.map((e) => [e.event, e.actor, e.at]),
      ];
    }
    case "cohort": {
      const d = data as {
        patients: {
          displayName: string;
          surgeryDate: string | null;
          recoveryDay: number | null;
          zone: string;
          adherencePct: number | null;
          lastCheckIn: string;
          threadStatus: string;
        }[];
      };
      return [
        [
          "Patient",
          "Surgery date",
          "Recovery day",
          "Zone",
          "Adherence %",
          "Last check-in",
          "Thread status",
        ],
        ...d.patients.map((p) => [
          p.displayName,
          p.surgeryDate ?? "",
          p.recoveryDay ?? "",
          p.zone,
          p.adherencePct ?? "n/a",
          p.lastCheckIn,
          p.threadStatus,
        ]),
      ];
    }
  }
}

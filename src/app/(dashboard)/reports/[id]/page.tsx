import Link from "next/link";
import { redirect } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  REPORT_TYPES,
  RESPONSE_TIME_NOTE,
  RLS_BLOCKED_NOTE,
  type ReportType,
} from "@/lib/reports";
import { buildReport } from "../builders";
import { PrintButton } from "../PrintButton";

export const dynamic = "force-dynamic";

type Period = { from: string; to: string; label: string };
type Zones = {
  green: number;
  yellow: number;
  orange: number;
  red: number;
  total: number;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ReportViewPage({
  params,
}: {
  params: { id: string };
}) {
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

  const { data: report } = await supabase
    .from("generated_reports")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!report) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-fv-text-secondary">
        Report not found.{" "}
        <Link href="/reports" className="text-fv-accent-strong">
          Back to Reports
        </Link>
      </main>
    );
  }

  // Lazy compute — period-bounded, so deterministic against generated_at.
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

  const { data: clinic } = await supabase
    .from("clinic_profile")
    .select("name, address, abn, phone, email, website")
    .limit(1)
    .maybeSingle();

  const meta = REPORT_TYPES.find((r) => r.key === report.report_type);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      {/* Toolbar — not printed */}
      <div className="fv-no-print mb-5 flex items-center justify-between">
        <Link href="/reports" className="text-sm text-fv-accent-strong">
          ← Reports
        </Link>
        <div className="flex gap-2">
          <a
            href={`/reports/${report.id}/csv`}
            className="rounded-md border border-fv-bg-soft px-4 py-2 text-sm font-medium text-fv-text-primary"
          >
            Download CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <article className="fv-report rounded-xl bg-white p-8 text-[#1F3A36] shadow-sm">
        {/* Letterhead */}
        <header className="flex items-center gap-4 border-b border-[#ECEEEE] pb-5">
          <FocusVisionLogo size={52} />
          <div>
            <div className="text-lg font-semibold">
              {clinic?.name ?? "Focus Vision"}
            </div>
            <div className="text-xs text-[#5C7672]">
              {clinic?.address ?? ""}
              {clinic?.abn ? ` · ABN ${clinic.abn}` : ""}
            </div>
            <div className="text-xs text-[#5C7672]">
              {[clinic?.phone, clinic?.email, clinic?.website]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </header>

        <div className="mt-5">
          <h1 className="text-xl font-semibold">
            {meta?.label ?? "Report"}
          </h1>
          <p className="mt-1 text-xs text-[#5C7672]">
            Generated {fmt(report.generated_at)}
            {report.auto_generated ? " · auto-generated" : ""} ·{" "}
            {report.include_identifiers
              ? "includes patient identifiers"
              : "de-identified (initials only)"}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-5 text-sm">
          {report.report_type === "monthly_activity" ? (
            <MonthlyReport data={data} />
          ) : null}
          {report.report_type === "surgeon" ? (
            <SurgeonReport data={data} />
          ) : null}
          {report.report_type === "compliance" ? (
            <ComplianceReport data={data} />
          ) : null}
          {report.report_type === "cohort" ? (
            <CohortReport data={data} />
          ) : null}
        </div>
      </article>
    </main>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-[#2E7A66]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ZoneLine({ zones }: { zones: Zones }) {
  const p = (n: number) =>
    zones.total > 0 ? Math.round((n / zones.total) * 100) : 0;
  return (
    <p>
      Green {zones.green} ({p(zones.green)}%) · Yellow {zones.yellow} (
      {p(zones.yellow)}%) · Orange {zones.orange} ({p(zones.orange)}%) · Red{" "}
      {zones.red} ({p(zones.red)}%)
    </p>
  );
}

function fmtPeriod(p: Period | undefined): string {
  return p ? p.label : "—";
}

// ── Per-type renderers ───────────────────────────────────────────────────
function MonthlyReport({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    period: Period;
    onboarded: {
      count: number;
      patients: {
        displayName: string;
        surgeryDate: string | null;
        procedure: string | null;
      }[];
    };
    checkIns: {
      completed: number;
      expected: number;
      completionPct: number;
      zones: Zones;
    };
    adherencePct: number | null;
    messages: { fromPatients: number; fromStaff: number; medianResponse: string };
    flags: {
      count: number;
      byLevel: Record<string, number>;
      avgResolutionHours: number | null;
    };
  };
  return (
    <>
      <p className="text-xs text-[#5C7672]">Period: {fmtPeriod(d.period)}</p>
      <Section title={`Patients onboarded (${d.onboarded.count})`}>
        {d.onboarded.patients.length === 0 ? (
          <p>No patients onboarded in this period.</p>
        ) : (
          <ul className="list-disc pl-5">
            {d.onboarded.patients.map((p, i) => (
              <li key={i}>
                {p.displayName} — {p.procedure ?? "no procedure"} ·{" "}
                {p.surgeryDate ?? "surgery date TBC"}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Check-ins completed">
        <p>
          {d.checkIns.completed} completed of ~{d.checkIns.expected} expected (
          {d.checkIns.completionPct}% completion)
        </p>
        <ZoneLine zones={d.checkIns.zones} />
      </Section>
      <Section title="Medication adherence">
        <p>
          {d.adherencePct === null
            ? "No doses scheduled in period."
            : `${d.adherencePct}% of doses taken across active patients.`}
        </p>
      </Section>
      <Section title="Messages">
        <p>
          {d.messages.fromPatients} from patients · {d.messages.fromStaff} from
          staff · median response {d.messages.medianResponse}
        </p>
        <p className="text-xs text-[#5C7672]">{RESPONSE_TIME_NOTE}</p>
      </Section>
      <Section title="Manual flags">
        <p>
          {d.flags.count} raised — yellow {d.flags.byLevel.yellow ?? 0}, orange{" "}
          {d.flags.byLevel.orange ?? 0}, red {d.flags.byLevel.red ?? 0}
        </p>
        <p>
          Average time to resolution:{" "}
          {d.flags.avgResolutionHours === null
            ? "—"
            : `${d.flags.avgResolutionHours}h`}
        </p>
      </Section>
    </>
  );
}

function SurgeonReport({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    period: Period;
    surgeon: string;
    patientCount: number;
    adherencePct: number | null;
    zones: Zones;
    medianResponse: string;
    flagRatePer100: number;
    flaggedPatients: {
      displayName: string;
      recoveryDay: number | null;
      level: string;
      outcome: string;
    }[];
  };
  return (
    <>
      <p className="text-xs text-[#5C7672]">
        {d.surgeon} · {fmtPeriod(d.period)}
      </p>
      <Section title="Summary">
        <p>Patients in period: {d.patientCount}</p>
        <p>
          Adherence:{" "}
          {d.adherencePct === null ? "—" : `${d.adherencePct}%`} · median
          message response {d.medianResponse}
        </p>
        <p>Manual-flag rate: {d.flagRatePer100} per 100 recovery-days</p>
      </Section>
      <Section title="Zone distribution">
        <ZoneLine zones={d.zones} />
      </Section>
      <Section title={`Flagged patients (${d.flaggedPatients.length})`}>
        {d.flaggedPatients.length === 0 ? (
          <p>No flagged patients.</p>
        ) : (
          <ul className="list-disc pl-5">
            {d.flaggedPatients.map((p, i) => (
              <li key={i}>
                {p.displayName} — day {p.recoveryDay ?? "?"} · {p.level} ·{" "}
                {p.outcome}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function ComplianceReport({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    period: Period;
    recordEditsByStaff: Record<string, number>;
    adminActions: Record<string, number>;
    exports: { event: string; actor: string; at: string }[];
  };
  return (
    <>
      <p className="text-xs text-[#5C7672]">Period: {fmtPeriod(d.period)}</p>
      <Section title="Record edits by staff member">
        {Object.keys(d.recordEditsByStaff).length === 0 ? (
          <p>No record edits in period.</p>
        ) : (
          <ul className="list-disc pl-5">
            {Object.entries(d.recordEditsByStaff).map(([who, n]) => (
              <li key={who}>
                {who}: {n}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Admin actions">
        {Object.keys(d.adminActions).length === 0 ? (
          <p>No admin actions in period.</p>
        ) : (
          <ul className="list-disc pl-5">
            {Object.entries(d.adminActions).map(([action, n]) => (
              <li key={action}>
                {action}: {n}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={`Data exports (${d.exports.length})`}>
        {d.exports.length === 0 ? (
          <p>No data exports in period.</p>
        ) : (
          <ul className="list-disc pl-5">
            {d.exports.map((e, i) => (
              <li key={i}>
                {e.event} — {e.actor} · {fmt(e.at)}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="RLS-blocked access attempts">
        <p className="text-xs text-[#5C7672]">{RLS_BLOCKED_NOTE}</p>
      </Section>
    </>
  );
}

function CohortReport({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    count: number;
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
  return (
    <Section title={`Patient cohort (${d.count})`}>
      {d.patients.length === 0 ? (
        <p>No patients match the filters.</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#ECEEEE] text-left text-[#5C7672]">
              <th className="py-1 pr-2">Patient</th>
              <th className="py-1 pr-2">Surgery</th>
              <th className="py-1 pr-2">Day</th>
              <th className="py-1 pr-2">Zone</th>
              <th className="py-1 pr-2">Adherence</th>
              <th className="py-1 pr-2">Last check-in</th>
              <th className="py-1">Thread</th>
            </tr>
          </thead>
          <tbody>
            {d.patients.map((p, i) => (
              <tr key={i} className="border-b border-[#F4F6F6]">
                <td className="py-1 pr-2">{p.displayName}</td>
                <td className="py-1 pr-2">{p.surgeryDate ?? "—"}</td>
                <td className="py-1 pr-2">{p.recoveryDay ?? "—"}</td>
                <td className="py-1 pr-2 capitalize">{p.zone}</td>
                <td className="py-1 pr-2">
                  {p.adherencePct === null ? "—" : `${p.adherencePct}%`}
                </td>
                <td className="py-1 pr-2">{p.lastCheckIn}</td>
                <td className="py-1 capitalize">{p.threadStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { REPORT_TYPES, isReportType, type ReportType } from "@/lib/reports";
import { generateReportAction, setReportScheduleAction } from "./actions";

export const dynamic = "force-dynamic";

const PROCEDURE_TYPES = ["lasik", "prk", "smile", "cataract", "icl"];
const input =
  "rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm";
const label = "text-xs font-medium text-fv-text-secondary";

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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { type?: string; error?: string };
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

  // Reception (tier 3) cannot generate or download reports.
  if (me?.access_tier !== 1 && me?.access_tier !== 2) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-fv-text-primary">
          Access denied
        </h1>
        <p className="mt-2 text-sm text-fv-text-secondary">
          Reports are available to clinic owners, admins and clinical staff.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-fv-accent-strong">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const type: ReportType = isReportType(searchParams.type)
    ? searchParams.type
    : "monthly_activity";

  const [{ data: history }, { data: schedule }, { data: surgeons }] =
    await Promise.all([
      supabase
        .from("generated_reports")
        .select("id, generated_at, auto_generated, include_identifiers")
        .eq("report_type", type)
        .order("generated_at", { ascending: false })
        .limit(25),
      supabase
        .from("report_schedules")
        .select("enabled")
        .eq("report_type", type)
        .maybeSingle(),
      supabase
        .from("staff_users")
        .select("id, name")
        .eq("role", "surgeon")
        .order("name"),
    ]);

  const meta = REPORT_TYPES.find((r) => r.key === type)!;
  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium ${
      active
        ? "border-b-2 border-fv-accent-strong text-fv-accent-strong"
        : "text-fv-text-secondary hover:text-fv-text-primary"
    }`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-fv-text-primary">Reports</h1>
      <p className="mt-1 text-sm text-fv-text-secondary">
        Generate clinic reports as a shareable, printable page.
      </p>

      {searchParams.error ? (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-fv-bg-soft">
        {REPORT_TYPES.map((r) => (
          <Link
            key={r.key}
            href={`/reports?type=${r.key}`}
            className={tabClass(r.key === type)}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Parameter form */}
      <section className="mt-5 rounded-xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fv-text-primary">
          {meta.label}
        </h2>
        <p className="mt-0.5 text-xs text-fv-text-secondary">
          {meta.description}
        </p>

        <form action={generateReportAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="report_type" value={type} />

          {type === "monthly_activity" ? (
            <label className="flex flex-col gap-1">
              <span className={label}>Month</span>
              <input type="month" name="month" className={`${input} w-fit`} />
            </label>
          ) : null}

          {type === "surgeon" ? (
            <>
              <label className="flex flex-col gap-1">
                <span className={label}>Surgeon</span>
                <select name="surgeonId" required className={`${input} w-fit`}>
                  <option value="">Select…</option>
                  {(surgeons ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <DateRange />
            </>
          ) : null}

          {type === "compliance" ? <DateRange /> : null}

          {type === "cohort" ? (
            <>
              <fieldset>
                <span className={label}>Procedures</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {PROCEDURE_TYPES.map((p) => (
                    <label
                      key={p}
                      className="flex items-center gap-1 rounded-full border border-fv-border px-2 py-1 text-xs"
                    >
                      <input type="checkbox" name="procedures" value={p} />
                      {p}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <span className={label}>Surgeons</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(surgeons ?? []).map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-1 rounded-full border border-fv-border px-2 py-1 text-xs"
                    >
                      <input type="checkbox" name="surgeonIds" value={s.id} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <DateRange />
              <label className="flex flex-col gap-1">
                <span className={label}>Current zone (optional)</span>
                <select name="zone" className={`${input} w-fit`}>
                  <option value="any">Any zone</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="orange">Orange</option>
                </select>
              </label>
            </>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="include_identifiers" />
            <span className="text-fv-text-primary">
              Include patient identifiers (full names)
            </span>
          </label>
          <p className="text-xs text-fv-text-secondary">
            Off by default — reports use initials so they carry no PII.
          </p>

          <button
            type="submit"
            className="self-start rounded-md bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Generate report
          </button>
        </form>

        {/* Monthly schedule toggle */}
        <form
          action={setReportScheduleAction}
          className="mt-4 flex items-center gap-3 border-t border-fv-bg-soft pt-3"
        >
          <input type="hidden" name="report_type" value={type} />
          {schedule?.enabled ? null : (
            <input type="hidden" name="enabled" value="on" />
          )}
          <span className="text-xs text-fv-text-secondary">
            Monthly auto-generation is{" "}
            <strong>{schedule?.enabled ? "ON" : "OFF"}</strong> — runs on the
            1st of each month.
          </span>
          <button
            type="submit"
            className="rounded-md border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary"
          >
            {schedule?.enabled ? "Turn off" : "Schedule monthly"}
          </button>
        </form>
      </section>

      {/* Previous generations */}
      <section className="mt-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
          Previously generated
        </h2>
        {(history ?? []).length === 0 ? (
          <p className="rounded-xl bg-fv-bg-card p-5 text-center text-sm text-fv-text-secondary shadow-sm">
            No reports generated yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(history ?? []).map((h) => (
              <li key={h.id}>
                <Link
                  href={`/reports/${h.id}`}
                  className="flex items-center justify-between rounded-xl bg-fv-bg-card p-4 shadow-sm hover:bg-fv-bg-soft/50"
                >
                  <span className="text-sm text-fv-text-primary">
                    {fmt(h.generated_at)}
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    {h.include_identifiers ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                        Identified
                      </span>
                    ) : null}
                    {h.auto_generated ? (
                      <span className="rounded-full bg-fv-bg-accent-soft px-2 py-0.5 text-fv-accent-strong">
                        Auto-generated
                      </span>
                    ) : null}
                    <span className="text-fv-accent-strong">Open →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function DateRange() {
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className={label}>From</span>
        <input type="date" name="from" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>To</span>
        <input type="date" name="to" className={input} />
      </label>
    </div>
  );
}

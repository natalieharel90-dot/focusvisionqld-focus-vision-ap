import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { initials } from "@/lib/bulk-push";
import {
  parseTemplateAppointments,
  parseTemplateMedications,
} from "@/lib/templates";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Left accent border per procedure type.
const TYPE_BORDER: Record<string, string> = {
  lasik: "border-l-emerald-500",
  prk: "border-l-amber-500",
  icl: "border-l-purple-500",
  cataract: "border-l-rose-500",
};

function typeBorder(t: string): string {
  return TYPE_BORDER[t.toLowerCase()] ?? "border-l-fv-border";
}

export default async function ProceduresLibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createSupabaseServerClient();
  const activeFilter = first(searchParams.filter) ?? "all";

  const [templatesResult, surgeonsResult, rulesetsResult, proceduresResult] =
    await Promise.all([
      supabase
        .from("procedure_templates")
        .select("*")
        .is("archived_at", null),
      supabase
        .from("staff_users")
        .select("id, name")
        .eq("role", "surgeon")
        .order("name"),
      supabase.from("routing_rulesets").select("id, name"),
      supabase
        .from("procedures")
        .select("source_template_id, created_at"),
    ]);

  const templates = templatesResult.data ?? [];
  const surgeons = surgeonsResult.data ?? [];
  const surgeonName = new Map(surgeons.map((s) => [s.id, s.name]));
  const rulesetNameById = new Map(
    (rulesetsResult.data ?? []).map((r) => [r.id, r.name])
  );

  // Patients onboarded per template, plus 90-day / all-time totals.
  const cutoff90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const onboardedByTemplate = new Map<string, number>();
  let onboardedTotal = 0;
  let onboarded90 = 0;
  for (const p of proceduresResult.data ?? []) {
    if (!p.source_template_id) continue;
    onboardedTotal += 1;
    if (Date.parse(p.created_at) >= cutoff90) onboarded90 += 1;
    onboardedByTemplate.set(
      p.source_template_id,
      (onboardedByTemplate.get(p.source_template_id) ?? 0) + 1
    );
  }

  const surgeonsWithTemplates = new Set(templates.map((t) => t.surgeon_id));
  const typesCovered = [
    ...new Set(templates.map((t) => t.procedure_type.toLowerCase())),
  ].sort();

  // Filter chips — "all", one per surgeon, one per procedure type.
  const surgeonChips = surgeons
    .map((s) => ({
      key: `s:${s.id}`,
      label: s.name,
      count: templates.filter((t) => t.surgeon_id === s.id).length,
    }))
    .filter((c) => c.count > 0);
  const typeChips = typesCovered.map((type) => ({
    key: `p:${type}`,
    label: type.toUpperCase(),
    count: templates.filter((t) => t.procedure_type.toLowerCase() === type)
      .length,
  }));

  const visible = templates
    .filter((t) => {
      if (activeFilter === "all") return true;
      if (activeFilter.startsWith("s:")) {
        return t.surgeon_id === activeFilter.slice(2);
      }
      if (activeFilter.startsWith("p:")) {
        return t.procedure_type.toLowerCase() === activeFilter.slice(2);
      }
      return true;
    })
    .sort(
      (a, b) =>
        (surgeonName.get(a.surgeon_id) ?? "").localeCompare(
          surgeonName.get(b.surgeon_id) ?? ""
        ) || a.procedure_type.localeCompare(b.procedure_type)
    );

  const stats = [
    {
      label: "Templates",
      value: String(templates.length),
      sub: `Across ${surgeonsWithTemplates.size} surgeon${
        surgeonsWithTemplates.size === 1 ? "" : "s"
      }`,
    },
    {
      label: "Procedure types",
      value: String(typesCovered.length),
      sub:
        typesCovered.map((t) => t.toUpperCase()).join(", ") || "None yet",
    },
    {
      label: "Onboarded · 90 days",
      value: String(onboarded90),
      sub: "Patients set up via templates",
    },
    {
      label: "Onboarded · all time",
      value: String(onboardedTotal),
      sub: "Since launch",
    },
  ];

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold ${
      active
        ? "bg-fv-accent-strong text-white"
        : "border border-fv-border text-fv-text-secondary hover:bg-fv-bg-soft"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fv-text-primary">
            Procedures library
          </h1>
          <p className="mt-1 text-sm text-fv-text-secondary">
            One template per (surgeon × procedure) — the defaults applied when
            a new patient is set up. Edit anytime; changes apply to future
            patients only.
          </p>
        </div>
        <Link
          href="/procedures/new"
          className="shrink-0 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Add template
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-fv-bg-card p-4 shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-fv-text-secondary">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-fv-text-primary">
              {s.value}
            </div>
            <div className="truncate text-xs text-fv-text-secondary">
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/procedures" className={chip(activeFilter === "all")}>
          All templates ({templates.length})
        </Link>
        {surgeonChips.map((c) => (
          <Link
            key={c.key}
            href={`/procedures?filter=${encodeURIComponent(c.key)}`}
            className={chip(activeFilter === c.key)}
          >
            {c.label} ({c.count})
          </Link>
        ))}
        {typeChips.map((c) => (
          <Link
            key={c.key}
            href={`/procedures?filter=${encodeURIComponent(c.key)}`}
            className={chip(activeFilter === c.key)}
          >
            {c.label} ({c.count})
          </Link>
        ))}
      </div>

      {/* Template list */}
      <div className="mt-5 flex flex-col gap-3">
        {visible.length === 0 ? (
          <p className="rounded-xl bg-fv-bg-card p-8 text-center text-sm text-fv-text-secondary shadow-sm">
            No templates match this filter.
          </p>
        ) : (
          visible.map((t) => {
            const meds = parseTemplateMedications(t.default_medications);
            const appts = parseTemplateAppointments(
              t.default_appointments
            );
            const onboarded = onboardedByTemplate.get(t.id) ?? 0;
            const rulesetName = t.linked_routing_ruleset_id
              ? rulesetNameById.get(t.linked_routing_ruleset_id)
              : null;
            return (
              <details
                key={t.id}
                className={`group overflow-hidden rounded-xl border-l-4 bg-fv-bg-card shadow-sm ${typeBorder(
                  t.procedure_type
                )}`}
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fv-accent-strong text-xs font-semibold text-white">
                    {initials(surgeonName.get(t.surgeon_id) ?? "?")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-fv-text-primary">
                      {surgeonName.get(t.surgeon_id) ?? "Unknown surgeon"} ·{" "}
                      {t.procedure_type.toUpperCase()}
                    </div>
                    <div className="mt-0.5 text-xs text-fv-text-secondary">
                      {onboarded} patient{onboarded === 1 ? "" : "s"} onboarded
                      · {meds.length} med{meds.length === 1 ? "" : "s"} ·{" "}
                      {appts.length} appointment
                      {appts.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/procedures/${t.id}`}
                      className="rounded-md bg-fv-accent-strong px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Edit
                    </Link>
                    <span className="text-xs font-semibold text-fv-text-secondary group-open:hidden">
                      Expand ▾
                    </span>
                    <span className="hidden text-xs font-semibold text-fv-text-secondary group-open:inline">
                      Collapse ▴
                    </span>
                  </span>
                </summary>

                <div className="border-t border-fv-bg-soft p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Default medications */}
                    <div>
                      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fv-text-secondary">
                        Default medications
                      </h3>
                      {meds.length === 0 ? (
                        <p className="text-xs text-fv-text-secondary">
                          None set.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {meds.map((m, i) => (
                            <li
                              key={i}
                              className="flex items-start justify-between gap-2 rounded-lg bg-fv-bg-soft/60 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-fv-text-primary">
                                  {m.name}
                                </div>
                                <div className="text-xs text-fv-text-secondary">
                                  {[m.dose, m.route, m.taper_notes]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                                {m.frequency}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Default appointment schedule */}
                    <div>
                      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fv-text-secondary">
                        Default appointment schedule
                      </h3>
                      {appts.length === 0 ? (
                        <p className="text-xs text-fv-text-secondary">
                          None set.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {appts.map((a, i) => (
                            <li
                              key={i}
                              className="flex items-start justify-between gap-2 rounded-lg bg-fv-bg-soft/60 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-fv-text-primary">
                                  {a.appointment_type}
                                </div>
                                <div className="text-xs capitalize text-fv-text-secondary">
                                  {(a.location ?? "in clinic").replace(
                                    "_",
                                    " "
                                  )}
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                                Day +{a.days_after_surgery}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-fv-bg-soft pt-3 text-xs text-fv-text-secondary">
                    <span>
                      Pre-op content:{" "}
                      <strong className="text-fv-text-primary">
                        {t.default_preop_content_ids.length}
                      </strong>{" "}
                      item
                      {t.default_preop_content_ids.length === 1 ? "" : "s"}
                    </span>
                    <span>
                      Post-op content:{" "}
                      <strong className="text-fv-text-primary">
                        {t.default_postop_content_ids.length}
                      </strong>{" "}
                      item
                      {t.default_postop_content_ids.length === 1 ? "" : "s"}
                    </span>
                    <span>
                      Recovery guidance:{" "}
                      <strong className="text-fv-text-primary">
                        {t.linked_recovery_guidance_id
                          ? "Linked"
                          : "Clinic default"}
                      </strong>
                    </span>
                    <span>
                      Routing rules:{" "}
                      <strong className="text-fv-text-primary">
                        {rulesetName ?? "Default ruleset"}
                      </strong>
                    </span>
                  </div>
                </div>
              </details>
            );
          })
        )}

        {/* Add another template */}
        <Link
          href="/procedures/new"
          className="flex items-center gap-3 rounded-xl border-2 border-dashed border-fv-bg-soft p-4 hover:border-fv-accent"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fv-bg-soft text-lg text-fv-text-secondary">
            +
          </span>
          <div>
            <div className="text-sm font-semibold text-fv-text-primary">
              Add another template
            </div>
            <div className="text-xs text-fv-text-secondary">
              Each (surgeon × procedure) combination can have its own template.
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}

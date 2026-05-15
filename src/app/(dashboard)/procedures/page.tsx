import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  parseTemplateAppointments,
  parseTemplateMedications,
} from "@/lib/templates";

export const dynamic = "force-dynamic";

const PROCEDURE_TYPES = ["lasik", "prk", "smile", "icl", "cataract"] as const;

export default async function ProceduresLibraryPage() {
  const supabase = createSupabaseServerClient();

  const [templatesResult, surgeonsResult, rulesetsResult] = await Promise.all([
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
  ]);

  const templates = templatesResult.data ?? [];
  const surgeons = surgeonsResult.data ?? [];
  const rulesetNameById = new Map(
    (rulesetsResult.data ?? []).map((r) => [r.id, r.name])
  );

  // Index templates by surgeon|procedure for the matrix lookup.
  const templateByCell = new Map(
    templates.map((t) => [`${t.surgeon_id}|${t.procedure_type}`, t])
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Procedures library
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Default medications, appointments, and content per (surgeon ×
          procedure). Applied — with per-patient overrides — when a new
          patient is set up.
        </p>
      </div>

      {surgeons.length === 0 ? (
        <p className="rounded-xl border border-dashed border-fv-bg-soft px-4 py-8 text-center text-sm text-fv-text-secondary">
          No surgeons on file yet.
        </p>
      ) : null}

      {surgeons.map((surgeon) => (
        <section key={surgeon.id} className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fv-text-secondary">
            {surgeon.name}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROCEDURE_TYPES.map((procedure) => {
              const template = templateByCell.get(
                `${surgeon.id}|${procedure}`
              );

              if (!template) {
                return (
                  <Link
                    key={procedure}
                    href={`/procedures/new?surgeon=${surgeon.id}&procedure=${procedure}`}
                    className="flex flex-col items-start justify-between rounded-xl border-2 border-dashed border-fv-bg-soft p-4 text-sm hover:border-fv-accent"
                  >
                    <span className="font-semibold uppercase text-fv-text-primary">
                      {procedure}
                    </span>
                    <span className="mt-2 text-xs font-semibold text-fv-accent-strong">
                      + Create template
                    </span>
                  </Link>
                );
              }

              const medCount = parseTemplateMedications(
                template.default_medications
              ).length;
              const apptCount = parseTemplateAppointments(
                template.default_appointments
              ).length;
              const rulesetName = template.linked_routing_ruleset_id
                ? rulesetNameById.get(template.linked_routing_ruleset_id)
                : null;

              return (
                <Link
                  key={procedure}
                  href={`/procedures/${template.id}`}
                  className="flex flex-col rounded-xl bg-fv-bg-card p-4 shadow-sm hover:shadow"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase text-fv-text-primary">
                      {procedure}
                    </span>
                    <span className="rounded-full bg-fv-bg-accent-soft px-2 py-0.5 text-xs font-medium text-fv-accent-strong">
                      template
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-fv-text-secondary">
                    {surgeon.name}
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-fv-text-secondary">
                    <div>
                      <span className="font-semibold text-fv-text-primary">
                        {medCount}
                      </span>{" "}
                      default medication{medCount === 1 ? "" : "s"}
                    </div>
                    <div>
                      <span className="font-semibold text-fv-text-primary">
                        {apptCount}
                      </span>{" "}
                      default appointment{apptCount === 1 ? "" : "s"}
                    </div>
                    {rulesetName ? (
                      <div>uses {rulesetName} routing ruleset</div>
                    ) : null}
                    {template.linked_recovery_guidance_id ? (
                      <div>custom recovery guidance linked</div>
                    ) : null}
                  </dl>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}

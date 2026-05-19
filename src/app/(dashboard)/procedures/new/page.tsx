import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { TemplateEditor } from "../TemplateEditor";

export const dynamic = "force-dynamic";

// Common procedures, offered as autocomplete suggestions. procedure_type is
// an open-ended free-text set — the clinic can add any procedure here.
const COMMON_PROCEDURES = ["lasik", "prk", "icl", "cataract"];

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: { surgeon?: string; procedure?: string; error?: string };
}) {
  const surgeonId = searchParams.surgeon?.trim();
  // Normalise to lower-case so a typed "LASIK" matches a seeded "lasik".
  const procedureType = searchParams.procedure?.trim().toLowerCase() || "";
  const supabase = createSupabaseServerClient();

  // No (surgeon × procedure) chosen yet — show the picker. Submitting it
  // reloads this page with the params, which then renders the editor.
  if (!surgeonId || !procedureType) {
    const [surgeonsResult, templatesResult] = await Promise.all([
      supabase
        .from("staff_users")
        .select("id, name")
        .eq("role", "surgeon")
        .order("name"),
      supabase.from("procedure_templates").select("procedure_type"),
    ]);
    const surgeons = surgeonsResult.data ?? [];

    // Suggestions = the common procedures plus any already in use.
    const suggestions = [
      ...new Set([
        ...COMMON_PROCEDURES,
        ...(templatesResult.data ?? []).map((t) =>
          t.procedure_type.toLowerCase()
        ),
      ]),
    ].sort();

    const inputCls =
      "rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm";

    return (
      <main className="mx-auto max-w-xl px-6 py-8">
        <Link
          href="/procedures"
          className="text-xs font-semibold text-fv-text-secondary hover:underline"
        >
          ← Procedures
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-fv-text-primary">
          Add a procedure template
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Pick the surgeon and procedure this template applies to. Each
          (surgeon × procedure) combination has one template. The next step
          sets up its default medications, appointments and content.
        </p>

        {surgeons.length === 0 ? (
          <p className="mt-6 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            No surgeons on file yet — add a surgeon in Settings first.
          </p>
        ) : (
          <form
            method="get"
            className="mt-6 flex flex-col gap-4 rounded-xl bg-fv-bg-card p-5 shadow-sm"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">Surgeon</span>
              <select name="surgeon" required className={inputCls}>
                <option value="">Select a surgeon…</option>
                {surgeons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">
                Procedure
              </span>
              <input
                type="text"
                name="procedure"
                required
                list="procedure-types"
                placeholder="Choose a procedure, or type a new one…"
                className={inputCls}
              />
              <datalist id="procedure-types">
                {suggestions.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </datalist>
              <span className="text-xs text-fv-text-secondary">
                Not in the list? Type any new procedure the clinic offers —
                it&apos;s added automatically when you save the template.
              </span>
            </label>
            <button
              type="submit"
              className="self-start rounded-md bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Continue
            </button>
          </form>
        )}
      </main>
    );
  }

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
    // Template already exists — open its editor instead.
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
      initialMedicationNotes={null}
      linkedRoutingRulesetId={null}
      rulesetOptions={rulesetsResult.data ?? []}
      saved={false}
      error={searchParams.error ?? null}
    />
  );
}

import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createPatientAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();

  // Active templates only — archived ones must not appear in the picker.
  const { data: templates } = await supabase
    .from("procedure_templates")
    .select("id, procedure_type, surgeon_id")
    .is("archived_at", null);

  const surgeonIds = Array.from(
    new Set((templates ?? []).map((t) => t.surgeon_id))
  );
  const { data: surgeons } =
    surgeonIds.length > 0
      ? await supabase
          .from("staff_users")
          .select("id, name")
          .in("id", surgeonIds)
      : { data: [] };
  const surgeonName = new Map(
    (surgeons ?? []).map((s) => [s.id, s.name])
  );

  const templateOptions = (templates ?? []).map((t) => ({
    id: t.id,
    label: `${surgeonName.get(t.surgeon_id) ?? "—"} · ${t.procedure_type.toUpperCase()}`,
  }));

  const { data: facilities } = await supabase
    .from("partner_facilities")
    .select("id, name")
    .eq("active", true)
    .order("name");

  const inputCls =
    "rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <Link
        href="/patients"
        className="text-xs font-semibold text-fv-text-secondary hover:underline"
      >
        ← Patients
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-fv-text-primary">
        Set up new patient
      </h1>
      <p className="mt-1 text-sm text-fv-text-secondary">
        Picking a template applies its default medications and appointments
        to the new patient automatically.
      </p>

      {searchParams.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {templateOptions.length === 0 ? (
        <p className="mt-6 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          No active procedure templates. Create one in the{" "}
          <Link href="/procedures" className="underline">
            Procedures library
          </Link>{" "}
          first.
        </p>
      ) : (
        <form
          action={createPatientAction}
          className="mt-6 flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">
                First name
              </span>
              <input
                type="text"
                name="first_name"
                required
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">Surname</span>
              <input type="text" name="last_name" className={inputCls} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">Email</span>
            <input type="email" name="email" required className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">Eye(s)</span>
              <select name="eye" required defaultValue="both" className={inputCls}>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fv-text-primary">
                Surgery date
              </span>
              <input
                type="date"
                name="surgery_date"
                required
                className={inputCls}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">
              Procedure template
            </span>
            <select name="template_id" required className={inputCls}>
              <option value="">Select a (surgeon × procedure)…</option>
              {templateOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">
              Day hospital (optional)
            </span>
            <select name="facility_id" defaultValue="" className={inputCls}>
              <option value="">Not set</option>
              {(facilities ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <p className="rounded-md bg-fv-bg-soft px-3 py-2 text-xs text-fv-text-secondary">
            The patient is created with a temporary password
            (<code>FocusVisionRecovery</code>) — they reset it on first
            sign-in.
          </p>

          <button
            type="submit"
            className="self-end rounded-md bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white"
          >
            Create patient & apply template
          </button>
        </form>
      )}
    </main>
  );
}

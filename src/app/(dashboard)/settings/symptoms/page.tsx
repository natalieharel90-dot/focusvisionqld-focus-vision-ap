import { createSupabaseServerClient } from "@/lib/supabase-server";
import { addSymptomAction, toggleSymptomAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SymptomsPage({
  searchParams,
}: {
  searchParams: { error?: string; added?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: symptoms } = await supabase
    .from("symptom_options")
    .select("*")
    .order("order_index");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Standard symptom options
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          The chip set shown to patients on their daily check-in. Adding a
          new symptom auto-creates an Orange routing rule in the Default
          ruleset (you can override on a per-procedure or per-surgeon basis
          in Alert thresholds).
        </p>
      </div>

      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {searchParams.added ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          New symptom added: <strong>{searchParams.added}</strong>. A default
          routing rule (Orange) was created automatically — adjust it in{" "}
          <a href="/settings/alert-thresholds" className="underline">
            Alert thresholds
          </a>{" "}
          if needed.
        </p>
      ) : null}

      {/* Add new symptom */}
      <form
        action={addSymptomAction}
        className="mb-8 grid grid-cols-3 gap-3 rounded-xl bg-fv-bg-card p-5 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fv-text-secondary">Key (snake_case)</span>
          <input
            type="text"
            name="key"
            required
            placeholder="e.g. blurred_vision"
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fv-text-secondary">Label</span>
          <input
            type="text"
            name="label"
            required
            placeholder="e.g. Blurred vision"
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-fv-text-secondary">Order index</span>
          <input
            type="number"
            name="order_index"
            defaultValue={120}
            className="rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-1.5"
          />
        </label>
        <button
          type="submit"
          className="col-span-3 mt-1 rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
        >
          Add symptom
        </button>
      </form>

      {/* Existing list */}
      <ul className="divide-y divide-fv-bg-soft overflow-hidden rounded-xl bg-fv-bg-card shadow-sm">
        {(symptoms ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium text-fv-text-primary">
                {s.label}
                {!s.active ? (
                  <span className="ml-2 rounded-full bg-fv-bg-soft px-2 py-0.5 text-xs font-medium text-fv-text-secondary">
                    inactive
                  </span>
                ) : null}
              </div>
              <code className="text-xs text-fv-text-secondary">{s.key}</code>
            </div>
            <form action={toggleSymptomAction}>
              <input type="hidden" name="symptom_id" value={s.id} />
              <input
                type="hidden"
                name="next_active"
                value={s.active ? "0" : "1"}
              />
              <button
                type="submit"
                className="rounded-md border border-fv-bg-soft px-3 py-1.5 text-xs font-semibold text-fv-text-primary"
              >
                {s.active ? "Deactivate" : "Activate"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}

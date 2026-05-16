import { createSupabaseServerClient } from "@/lib/supabase-server";
import { deleteSymptomAction } from "./actions";
import { AddSymptomModal } from "./AddSymptomModal";

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
    <main className="mx-auto max-w-5xl px-6 py-6">
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

      <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fv-text-primary">
              Standard symptom options
            </h2>
            <p className="mt-0.5 text-xs text-fv-text-secondary">
              These are the symptom options the patient sees in the daily
              check-in if they tap &quot;Yes&quot; to unusual symptoms. The
              &quot;Other&quot; option (with free-text describe box) is always
              shown at the end.
            </p>
          </div>
          <AddSymptomModal />
        </div>

        {(symptoms ?? []).length === 0 ? (
          <p className="mt-4 rounded-xl bg-fv-bg-soft/50 p-6 text-center text-sm text-fv-text-secondary">
            No symptom options yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {(symptoms ?? []).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-fv-bg-soft/40 px-4 py-3"
              >
                <span className="text-sm text-fv-text-primary">{s.label}</span>
                <form action={deleteSymptomAction}>
                  <input type="hidden" name="symptom_id" value={s.id} />
                  <button
                    type="submit"
                    className="text-sm font-semibold text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

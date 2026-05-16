import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadPatientFeatures } from "@/lib/patient-features-server";
import { PhotoUploadField } from "./PhotoUploadField";
import { SymptomsCard } from "./SymptomsCard";
import { submitCheckInAction } from "./actions";

export const dynamic = "force-dynamic";

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(`${dateStr}T00:00:00Z`).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
}

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const [features, procedureRes, symptomsRes, clinicRes] = await Promise.all([
    loadPatientFeatures(supabase, user.id),
    supabase
      .from("procedures")
      .select("procedure_type, surgery_date")
      .eq("patient_id", user.id)
      .eq("status", "active")
      .order("surgery_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("symptom_options")
      .select("key, label")
      .eq("active", true)
      .order("order_index"),
    supabase.from("clinic_profile").select("phone").limit(1).maybeSingle(),
  ]);

  const procedure = procedureRes.data;
  const recoveryDay = daysSince(procedure?.surgery_date ?? null);
  const meta = [
    recoveryDay != null ? `Day ${recoveryDay}` : null,
    procedure?.procedure_type?.toUpperCase() ?? null,
    "takes ~2 minutes",
  ]
    .filter(Boolean)
    .join(" · ");

  const cardCls = "rounded-2xl bg-fv-bg-card p-5 shadow-sm";
  const scaleBtn =
    "block rounded-xl bg-fv-bg-soft py-3 text-center font-semibold text-fv-text-primary peer-checked:bg-fv-accent-strong peer-checked:text-white";

  return (
    <main className="flex flex-col gap-4 px-5 py-5">
      <header>
        <h1 className="text-2xl font-bold text-fv-text-primary">
          Today&apos;s check-in
        </h1>
        <p className="mt-0.5 text-sm text-fv-text-secondary">{meta}</p>
      </header>

      {searchParams.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <form action={submitCheckInAction} className="flex flex-col gap-4">
        {/* Vision */}
        <section className={cardCls}>
          <h2 className="text-base font-semibold text-fv-text-primary">
            How is your vision today?
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {(
              [
                { v: "worse", label: "Worse" },
                { v: "same", label: "Same" },
                { v: "better", label: "Better" },
              ] as const
            ).map(({ v, label }) => (
              <label key={v} className="cursor-pointer">
                <input
                  type="radio"
                  name="vision"
                  value={v}
                  required
                  className="peer sr-only"
                />
                <span className={scaleBtn}>{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-fv-text-secondary">
            Compared to yesterday
          </p>
        </section>

        {/* Pain */}
        <section className={cardCls}>
          <h2 className="text-base font-semibold text-fv-text-primary">
            How is your eye pain level?
          </h2>
          <div className="mt-3 grid grid-cols-6 gap-2 text-sm">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input
                  type="radio"
                  name="pain"
                  value={n}
                  required
                  className="peer sr-only"
                />
                <span className={scaleBtn}>{n}</span>
              </label>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-fv-text-secondary">
            <span>None</span>
            <span>Severe</span>
          </div>
        </section>

        {/* Light sensitivity */}
        <section className={cardCls}>
          <h2 className="text-base font-semibold text-fv-text-primary">
            How is your light sensitivity?
          </h2>
          <div className="mt-3 grid grid-cols-6 gap-2 text-sm">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input
                  type="radio"
                  name="light_sensitivity"
                  value={n}
                  required
                  className="peer sr-only"
                />
                <span className={scaleBtn}>{n}</span>
              </label>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-fv-text-secondary">
            <span>None</span>
            <span>Severe</span>
          </div>
        </section>

        {/* Unusual symptoms */}
        <SymptomsCard
          symptoms={symptomsRes.data ?? []}
          clinicPhone={clinicRes.data?.phone ?? null}
        />

        {/* Optional photo — gated by the eye_photo_prompt feature flag. */}
        {features.eye_photo_prompt ? (
          <PhotoUploadField patientId={user.id} />
        ) : null}

        <button
          type="submit"
          className="rounded-xl bg-fv-accent-strong px-4 py-3.5 text-base font-semibold text-white hover:opacity-95"
        >
          Submit check-in
        </button>
      </form>
    </main>
  );
}

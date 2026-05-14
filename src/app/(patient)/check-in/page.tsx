import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PhotoUploadField } from "./PhotoUploadField";
import { submitCheckInAction } from "./actions";

export const dynamic = "force-dynamic";

const SYMPTOM_CHIPS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "halos", label: "Halos around lights" },
  { key: "floaters", label: "Floaters" },
  { key: "flashes_of_light", label: "Flashes of light" },
  { key: "shadow_curtain", label: "Shadow or curtain in vision" },
  { key: "sudden_vision_loss", label: "Sudden vision loss" },
  { key: "eye_pain", label: "Eye pain" },
  { key: "severe_pain", label: "Severe pain" },
  { key: "discharge", label: "Discharge" },
  { key: "itching", label: "Itching" },
  { key: "watering", label: "Watering" },
  { key: "grittiness", label: "Grittiness" },
];

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

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Today&apos;s check-in
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Takes about a minute. Your care team reviews each response.
        </p>
      </header>

      {searchParams.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <form action={submitCheckInAction} className="flex flex-col gap-5">
        {/* Q1 — Vision */}
        <fieldset className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-fv-text-primary">
            How is your vision compared to yesterday?
          </legend>
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
                <span className="block rounded-md border border-fv-bg-soft bg-white py-2 text-center font-medium text-fv-text-primary peer-checked:border-fv-accent-strong peer-checked:bg-fv-accent-strong peer-checked:text-white">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Q2 — Pain */}
        <fieldset className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-fv-text-primary">
            Pain level
          </legend>
          <p className="mt-1 text-xs text-fv-text-secondary">
            0 = none · 5 = severe
          </p>
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
                <span className="block rounded-md border border-fv-bg-soft bg-white py-2 text-center font-semibold text-fv-text-primary peer-checked:border-fv-accent-strong peer-checked:bg-fv-accent-strong peer-checked:text-white">
                  {n}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Q3 — Light sensitivity */}
        <fieldset className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-fv-text-primary">
            Light sensitivity
          </legend>
          <p className="mt-1 text-xs text-fv-text-secondary">
            0 = comfortable · 5 = painful
          </p>
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
                <span className="block rounded-md border border-fv-bg-soft bg-white py-2 text-center font-semibold text-fv-text-primary peer-checked:border-fv-accent-strong peer-checked:bg-fv-accent-strong peer-checked:text-white">
                  {n}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Q4 — Unusual symptoms */}
        <fieldset className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-fv-text-primary">
            Anything unusual today?
          </legend>
          <p className="mt-1 text-xs text-fv-text-secondary">
            Tap any that apply. Leave blank if all is well.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {SYMPTOM_CHIPS.map((chip) => (
              <label key={chip.key} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="symptom"
                  value={chip.key}
                  className="peer sr-only"
                />
                <span className="block rounded-full border border-fv-bg-soft bg-white px-3 py-1.5 text-fv-text-primary peer-checked:border-fv-accent-strong peer-checked:bg-fv-accent-strong peer-checked:text-white">
                  {chip.label}
                </span>
              </label>
            ))}
          </div>
          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="font-medium text-fv-text-primary">
              Other (describe in your own words)
            </span>
            <textarea
              name="other_description"
              rows={2}
              placeholder="Optional — anything else you noticed."
              className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-sm"
            />
          </label>
        </fieldset>

        {/* Optional photo */}
        <PhotoUploadField patientId={user.id} />

        <button
          type="submit"
          className="rounded-xl bg-fv-accent-strong px-4 py-3 text-base font-semibold text-white"
        >
          Submit check-in
        </button>
      </form>
    </main>
  );
}

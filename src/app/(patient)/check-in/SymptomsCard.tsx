"use client";

import { useState } from "react";

type Symptom = { key: string; label: string };

// The "Any unusual symptoms?" check-in card. No keeps the card collapsed;
// Yes reveals the symptom chips; tapping "Other" reveals a free-text box.
export function SymptomsCard({
  symptoms,
  clinicPhone,
}: {
  symptoms: Symptom[];
  clinicPhone: string | null;
}) {
  const [unusual, setUnusual] = useState<"no" | "yes" | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [otherOn, setOtherOn] = useState(false);

  function toggleChip(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const chipBase =
    "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors";

  return (
    <section className="rounded-2xl bg-fv-bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-fv-text-primary">
        Any unusual symptoms?
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {(["no", "yes"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setUnusual(v)}
            className={`rounded-xl py-3 text-base font-semibold capitalize ${
              unusual === v
                ? "bg-fv-accent-strong text-white"
                : "bg-fv-bg-soft text-fv-text-primary"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {unusual === "yes" ? (
        <>
          <p className="mt-4 text-sm font-semibold text-fv-text-primary">
            Please tap any that apply
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {symptoms.map((s) => {
              const on = selected.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleChip(s.key)}
                  className={`${chipBase} ${
                    on
                      ? "bg-fv-accent-strong text-white"
                      : "bg-fv-bg-soft text-fv-text-primary"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setOtherOn((o) => !o)}
              className={`${chipBase} ${
                otherOn
                  ? "bg-fv-accent-strong text-white"
                  : "bg-fv-bg-soft text-fv-text-primary"
              }`}
            >
              Other
            </button>
          </div>

          {otherOn ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-fv-text-primary">
                Please describe your symptoms
              </p>
              <textarea
                name="other_description"
                rows={3}
                placeholder="What are you experiencing? When did it start? Which eye?"
                className="mt-2 w-full rounded-xl border border-fv-bg-soft bg-fv-bg-card px-3 py-2.5 text-sm"
              />
            </div>
          ) : null}

          <div className="mt-4 rounded-r-lg border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-800">
            <strong>If symptoms are severe</strong> — sudden vision loss,
            severe pain, or a chemical splash —{" "}
            {clinicPhone ? (
              <>
                please call the clinic now{" "}
                <a href={`tel:${clinicPhone.replace(/[^\d+]/g, "")}`} className="font-semibold underline">
                  {clinicPhone}
                </a>{" "}
                instead of waiting.
              </>
            ) : (
              "please call the clinic now instead of waiting."
            )}
          </div>

          {/* Hidden inputs the check-in action consumes. */}
          {[...selected].map((key) => (
            <input key={key} type="hidden" name="symptom" value={key} />
          ))}
        </>
      ) : null}
    </section>
  );
}

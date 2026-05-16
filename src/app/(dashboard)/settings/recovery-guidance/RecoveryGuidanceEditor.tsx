"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PLACEHOLDER_WARNING, type ZoneContentFields } from "@/lib/zone-content";
import { saveZoneContentAction } from "./actions";

type Zone = "green" | "yellow" | "orange";
type Tier = "default" | "procedure" | "surgeon" | "procedure_surgeon";

type ZoneFormState = {
  headline: string;
  message: string;
  expected_symptoms: string; // textarea — one symptom per line
  today_tip: string;
  instructions: string;
  warning: string;
};

export type RecoveryGuidanceEditorProps = {
  procedureType: string | null;
  surgeonId: string | null;
  procedureOptions: ReadonlyArray<string>;
  surgeonOptions: ReadonlyArray<{ id: string; name: string }>;
  tier: Tier;
  procedureLabel: string | null;
  surgeonLabel: string | null;
  green: ZoneContentFields;
  yellow: ZoneContentFields;
  orange: ZoneContentFields;
  savedZone: string | null;
  error: string | null;
};

const ZONE_META: Record<
  Zone,
  {
    label: string;
    hero: string;
    heroText: string;
    hasWarning: boolean;
    dot: string;
    accent: string;
  }
> = {
  green: {
    label: "Green — on track",
    hero: "bg-green-100",
    heroText: "text-green-900",
    hasWarning: false,
    dot: "bg-green-500",
    accent: "border-l-4 border-green-600",
  },
  yellow: {
    label: "Yellow — keep an eye on this",
    hero: "bg-yellow-100",
    heroText: "text-yellow-900",
    hasWarning: true,
    dot: "bg-yellow-400",
    accent: "border-l-4 border-yellow-500",
  },
  orange: {
    label: "Orange — we'll be in touch",
    hero: "bg-orange-100",
    heroText: "text-orange-900",
    hasWarning: true,
    dot: "bg-orange-500",
    accent: "border-l-4 border-orange-500",
  },
};

const TIER_BOX: Record<Tier, { bg: string; border: string }> = {
  default: { bg: "bg-fv-bg-soft", border: "border-fv-text-secondary" },
  procedure: { bg: "bg-blue-50", border: "border-blue-400" },
  surgeon: { bg: "bg-purple-50", border: "border-purple-400" },
  procedure_surgeon: { bg: "bg-amber-50", border: "border-amber-500" },
};

function toFormState(f: ZoneContentFields): ZoneFormState {
  return {
    headline: f.headline ?? "",
    message: f.message ?? "",
    expected_symptoms: (f.expected_symptoms ?? []).join("\n"),
    today_tip: f.today_tip ?? "",
    instructions: f.instructions ?? "",
    warning: f.warning ?? "",
  };
}

export function RecoveryGuidanceEditor(props: RecoveryGuidanceEditorProps) {
  const router = useRouter();
  const params = useSearchParams();

  const [forms, setForms] = useState<Record<Zone, ZoneFormState>>({
    green: toFormState(props.green),
    yellow: toFormState(props.yellow),
    orange: toFormState(props.orange),
  });

  const [previewZone, setPreviewZone] = useState<Zone | null>(null);
  const previewRef = useRef<HTMLDialogElement>(null);

  function update(zone: Zone, patch: Partial<ZoneFormState>) {
    setForms((prev) => ({ ...prev, [zone]: { ...prev[zone], ...patch } }));
  }

  function navigateScope(procedure: string | null, surgeon: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (procedure) sp.set("procedure", procedure);
    else sp.delete("procedure");
    if (surgeon) sp.set("surgeon", surgeon);
    else sp.delete("surgeon");
    sp.delete("saved");
    sp.delete("error");
    router.push(`/settings/recovery-guidance?${sp.toString()}`);
  }

  function openPreview(zone: Zone) {
    setPreviewZone(zone);
    previewRef.current?.showModal();
  }

  const tierBox = TIER_BOX[props.tier];
  const infoText: Record<Tier, string> = {
    default:
      "Clinic-wide default. Every patient sees this guidance unless a more-specific set overrides individual fields.",
    procedure: `Procedure-only override for ${props.procedureLabel ?? "—"}. Any field left matching the parent falls back to Default.`,
    surgeon: `Surgeon-only override for ${props.surgeonLabel ?? "—"}'s patients. Any field left matching the parent falls back to Default.`,
    procedure_surgeon: `Most specific: ${props.procedureLabel} × ${props.surgeonLabel}. Per-field fallback walks ${props.surgeonLabel} → ${props.procedureLabel} → Default.`,
  };

  const inputCls =
    "rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-fv-text-primary">
        Recovery guidance
      </h1>
      <p className="mt-1 text-sm text-fv-text-secondary">
        What patients see after their daily check-in, per (procedure ×
        surgeon). Fallback is per-field — override only what differs.
      </p>

      {/* Placeholder content warning */}
      <div className="mt-4 rounded-xl border-l-4 border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
        <strong>⚠️ Needs clinical sign-off.</strong> {PLACEHOLDER_WARNING}
      </div>

      {/* Scope picker */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
            Procedure
          </span>
          <select
            value={props.procedureType ?? ""}
            onChange={(e) =>
              navigateScope(e.target.value || null, props.surgeonId)
            }
            className={inputCls}
          >
            <option value="">★ Default (all procedures)</option>
            {props.procedureOptions.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
            Surgeon
          </span>
          <select
            value={props.surgeonId ?? ""}
            onChange={(e) =>
              navigateScope(props.procedureType, e.target.value || null)
            }
            className={inputCls}
          >
            <option value="">★ Default (all surgeons)</option>
            {props.surgeonOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className={`mt-4 rounded-xl border-l-4 ${tierBox.bg} ${tierBox.border} px-4 py-3 text-sm text-fv-text-primary`}
      >
        {infoText[props.tier]}
      </div>

      {props.error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {props.error}
        </p>
      ) : null}

      {/* Three zone editors */}
      <div className="mt-6 space-y-5">
        {(["green", "yellow", "orange"] as const).map((zone) => {
          const meta = ZONE_META[zone];
          const form = forms[zone];
          return (
            <form
              key={zone}
              action={saveZoneContentAction}
              className={`rounded-xl ${meta.accent} bg-fv-bg-card p-5 shadow-sm`}
            >
              <input type="hidden" name="zone" value={zone} />
              <input
                type="hidden"
                name="procedure_type"
                value={props.procedureType ?? ""}
              />
              <input
                type="hidden"
                name="surgeon_id"
                value={props.surgeonId ?? ""}
              />

              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-fv-text-primary">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`}
                  />
                  {meta.label}
                </h2>
                {props.savedZone === zone ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    Saved
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-fv-text-secondary">
                    Headline
                  </span>
                  <input
                    type="text"
                    name="headline"
                    value={form.headline}
                    onChange={(e) =>
                      update(zone, { headline: e.target.value })
                    }
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-fv-text-secondary">
                    Message from care team
                  </span>
                  <textarea
                    name="message"
                    rows={3}
                    value={form.message}
                    onChange={(e) =>
                      update(zone, { message: e.target.value })
                    }
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-fv-text-secondary">
                    Expected symptoms (one per line)
                  </span>
                  <textarea
                    name="expected_symptoms"
                    rows={5}
                    value={form.expected_symptoms}
                    onChange={(e) =>
                      update(zone, { expected_symptoms: e.target.value })
                    }
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-fv-text-secondary">
                    Today&apos;s tip
                  </span>
                  <textarea
                    name="today_tip"
                    rows={2}
                    value={form.today_tip}
                    onChange={(e) =>
                      update(zone, { today_tip: e.target.value })
                    }
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-fv-text-secondary">
                    Instructions (optional)
                  </span>
                  <textarea
                    name="instructions"
                    rows={2}
                    value={form.instructions}
                    onChange={(e) =>
                      update(zone, { instructions: e.target.value })
                    }
                    className={inputCls}
                  />
                </label>
                {meta.hasWarning ? (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-fv-text-secondary">
                      Warning (optional)
                    </span>
                    <textarea
                      name="warning"
                      rows={2}
                      value={form.warning}
                      onChange={(e) =>
                        update(zone, { warning: e.target.value })
                      }
                      className={inputCls}
                    />
                  </label>
                ) : (
                  <input type="hidden" name="warning" value="" />
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => openPreview(zone)}
                  className="rounded-md border border-fv-bg-soft px-3 py-1.5 text-xs font-semibold text-fv-text-primary"
                >
                  Preview as patient
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
                >
                  Save {zone}
                </button>
              </div>
            </form>
          );
        })}
      </div>

      {/* Preview dialog — phone-shaped mock of the patient result screen */}
      <dialog
        ref={previewRef}
        className="rounded-3xl bg-transparent p-0 backdrop:bg-black/50"
      >
        {previewZone ? (
          <PhonePreview
            zone={previewZone}
            form={forms[previewZone]}
            onClose={() => previewRef.current?.close()}
          />
        ) : null}
      </dialog>
    </main>
  );
}

function PhonePreview({
  zone,
  form,
  onClose,
}: {
  zone: Zone;
  form: ZoneFormState;
  onClose: () => void;
}) {
  const meta = ZONE_META[zone];
  const symptoms = form.expected_symptoms
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="w-[320px] overflow-hidden rounded-3xl border-8 border-fv-text-primary bg-fv-bg-app">
      <div className="max-h-[560px] overflow-y-auto p-4">
        <div className={`rounded-2xl ${meta.hero} p-4 ${meta.heroText}`}>
          <div className="text-xs font-bold uppercase tracking-wider opacity-75">
            Day 4 · {zone}
          </div>
          <h3 className="mt-1 text-xl font-semibold">
            {form.headline || "(headline)"}
          </h3>
          {form.message ? (
            <p className="mt-2 text-sm leading-relaxed">{form.message}</p>
          ) : null}
        </div>

        {symptoms.length > 0 ? (
          <div className="mt-3 rounded-2xl bg-fv-bg-card p-4">
            <h4 className="text-sm font-semibold text-fv-text-primary">
              What&apos;s normal right now
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fv-text-primary">
              {symptoms.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {form.today_tip ? (
          <div className="mt-3 rounded-2xl bg-fv-bg-card p-4">
            <h4 className="text-sm font-semibold text-fv-text-primary">
              Today&apos;s tip
            </h4>
            <p className="mt-2 text-sm text-fv-text-primary">
              {form.today_tip}
            </p>
          </div>
        ) : null}

        {form.instructions ? (
          <div className="mt-3 rounded-2xl bg-fv-bg-card p-4">
            <h4 className="text-sm font-semibold text-fv-text-primary">
              What to do
            </h4>
            <p className="mt-2 text-sm text-fv-text-primary">
              {form.instructions}
            </p>
          </div>
        ) : null}

        {form.warning ? (
          <div className="mt-3 rounded-2xl bg-orange-50 p-4 text-orange-900">
            <p className="text-sm font-medium">{form.warning}</p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full bg-fv-text-primary py-3 text-sm font-semibold text-white"
      >
        Close preview
      </button>
    </div>
  );
}

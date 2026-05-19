"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  TemplateAppointment,
  TemplateMedication,
} from "@/lib/templates";
import { archiveTemplateAction, saveTemplateAction } from "./actions";

type RulesetOption = { id: string; name: string };

export type TemplateEditorProps = {
  templateId: string | null;
  surgeonId: string;
  surgeonName: string;
  procedureType: string;
  initialMedications: TemplateMedication[];
  initialAppointments: TemplateAppointment[];
  linkedRoutingRulesetId: string | null;
  rulesetOptions: ReadonlyArray<RulesetOption>;
  saved: boolean;
  error: string | null;
};

const EMPTY_MED: TemplateMedication = {
  name: "",
  dose: "",
  route: "topical eye",
  frequency: "",
  scheduled_times: [],
  taper_notes: null,
  duration_days: null,
  start_offset_days: 0,
};

const EMPTY_APPT: TemplateAppointment = {
  appointment_type: "",
  days_after_surgery: 7,
  location: "in_clinic",
  notes: null,
};

export function TemplateEditor(props: TemplateEditorProps) {
  const [meds, setMeds] = useState<TemplateMedication[]>(
    props.initialMedications
  );
  const [appts, setAppts] = useState<TemplateAppointment[]>(
    props.initialAppointments
  );
  const [rulesetId, setRulesetId] = useState<string>(
    props.linkedRoutingRulesetId ?? ""
  );

  function updateMed(i: number, patch: Partial<TemplateMedication>) {
    setMeds((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    );
  }
  function updateAppt(i: number, patch: Partial<TemplateAppointment>) {
    setAppts((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
    );
  }

  const inputCls =
    "rounded-md border border-fv-bg-soft bg-fv-bg-card px-2 py-1 text-sm";
  const fieldLabelCls = "text-[11px] font-medium text-fv-text-secondary";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/procedures"
          className="text-xs font-semibold text-fv-text-secondary hover:underline"
        >
          ← Procedures library
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-fv-text-primary">
          {props.surgeonName} · {props.procedureType.toUpperCase()}
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          {props.templateId
            ? "Editing template. Changes apply to future patient set-ups only."
            : "New template for this (surgeon × procedure) combination."}
        </p>
      </div>

      {props.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {props.error}
        </p>
      ) : null}
      {props.saved ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Template saved.
        </p>
      ) : null}

      <form action={saveTemplateAction} className="space-y-6">
        <input
          type="hidden"
          name="template_id"
          value={props.templateId ?? ""}
        />
        <input type="hidden" name="surgeon_id" value={props.surgeonId} />
        <input
          type="hidden"
          name="procedure_type"
          value={props.procedureType}
        />
        <input
          type="hidden"
          name="default_medications"
          value={JSON.stringify(meds)}
        />
        <input
          type="hidden"
          name="default_appointments"
          value={JSON.stringify(appts)}
        />
        <input
          type="hidden"
          name="linked_routing_ruleset_id"
          value={rulesetId}
        />

        {/* Default medications */}
        <section className="rounded-xl bg-fv-bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fv-text-primary">
              Default medications
            </h2>
            <button
              type="button"
              onClick={() => setMeds((p) => [...p, { ...EMPTY_MED }])}
              className="text-xs font-semibold text-fv-accent-strong"
            >
              + Add medication
            </button>
          </div>
          {meds.length === 0 ? (
            <p className="text-sm text-fv-text-secondary">
              No default medications.
            </p>
          ) : (
            <ul className="space-y-3">
              {meds.map((m, i) => (
                <li
                  key={i}
                  className="grid grid-cols-2 gap-2 rounded-md bg-fv-bg-soft p-3"
                >
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>Name</span>
                    <input
                      className={inputCls}
                      placeholder="e.g. Pred Forte"
                      value={m.name}
                      onChange={(e) => updateMed(i, { name: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>Dose</span>
                    <input
                      className={inputCls}
                      placeholder="e.g. 1 drop"
                      value={m.dose}
                      onChange={(e) => updateMed(i, { dose: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>Route</span>
                    <input
                      className={inputCls}
                      placeholder="e.g. topical eye"
                      value={m.route}
                      onChange={(e) =>
                        updateMed(i, { route: e.target.value })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>Frequency</span>
                    <input
                      className={inputCls}
                      placeholder="e.g. 4x daily"
                      value={m.frequency}
                      onChange={(e) =>
                        updateMed(i, { frequency: e.target.value })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>Times each day</span>
                    <input
                      className={inputCls}
                      placeholder="08:00, 12:00, 16:00, 20:00"
                      value={m.scheduled_times.join(", ")}
                      onChange={(e) =>
                        updateMed(i, {
                          scheduled_times: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>Starts (days after surgery)</span>
                    <input
                      className={inputCls}
                      type="number"
                      value={m.start_offset_days ?? 0}
                      onChange={(e) =>
                        updateMed(i, {
                          start_offset_days: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>Duration (days)</span>
                    <input
                      className={inputCls}
                      type="number"
                      value={m.duration_days ?? ""}
                      onChange={(e) =>
                        updateMed(i, {
                          duration_days: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className={fieldLabelCls}>Taper notes (optional)</span>
                    <input
                      className={inputCls}
                      placeholder="e.g. 6x daily for 7 days, then 4x daily for 14 days"
                      value={m.taper_notes ?? ""}
                      onChange={(e) =>
                        updateMed(i, { taper_notes: e.target.value || null })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setMeds((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="col-span-2 justify-self-end text-xs font-semibold text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Default appointments */}
        <section className="rounded-xl bg-fv-bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fv-text-primary">
              Default appointments
            </h2>
            <button
              type="button"
              onClick={() => setAppts((p) => [...p, { ...EMPTY_APPT }])}
              className="text-xs font-semibold text-fv-accent-strong"
            >
              + Add appointment
            </button>
          </div>
          {appts.length === 0 ? (
            <p className="text-sm text-fv-text-secondary">
              No default appointments.
            </p>
          ) : (
            <ul className="space-y-3">
              {appts.map((a, i) => (
                <li
                  key={i}
                  className="grid grid-cols-2 gap-2 rounded-md bg-fv-bg-soft p-3"
                >
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>
                      Type
                    </span>
                    <input
                      className={inputCls}
                      placeholder="e.g. 1-week review"
                      value={a.appointment_type}
                      onChange={(e) =>
                        updateAppt(i, { appointment_type: e.target.value })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>
                      Days after surgery
                    </span>
                    <input
                      className={inputCls}
                      type="number"
                      value={a.days_after_surgery}
                      onChange={(e) =>
                        updateAppt(i, {
                          days_after_surgery: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>
                      Location
                    </span>
                    <select
                      className={inputCls}
                      value={a.location ?? ""}
                      onChange={(e) =>
                        updateAppt(i, {
                          location:
                            (e.target
                              .value as TemplateAppointment["location"]) ||
                            null,
                        })
                      }
                    >
                      <option value="">— location —</option>
                      <option value="in_clinic">In clinic</option>
                      <option value="phone">Phone</option>
                      <option value="video">Video</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabelCls}>
                      Notes
                    </span>
                    <input
                      className={inputCls}
                      placeholder="Optional"
                      value={a.notes ?? ""}
                      onChange={(e) =>
                        updateAppt(i, { notes: e.target.value || null })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAppts((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="col-span-2 justify-self-end text-xs font-semibold text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Linked routing ruleset */}
        <section className="rounded-xl bg-fv-bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-fv-text-primary">
            Linked routing ruleset
          </h2>
          <select
            value={rulesetId}
            onChange={(e) => setRulesetId(e.target.value)}
            className="w-full rounded-md border border-fv-bg-soft bg-fv-bg-card px-3 py-2 text-sm"
          >
            <option value="">— none (uses default routing) —</option>
            {props.rulesetOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-fv-text-secondary">
            Pre-op / post-op content libraries and named recovery-guidance
            sets attach here once the Content library is built (future
            session).
          </p>
        </section>

        <div className="flex items-center justify-between">
          {props.templateId ? (
            <button
              type="submit"
              formAction={archiveTemplateAction}
              className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
            >
              Archive template
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="rounded-md bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white"
          >
            Save template
          </button>
        </div>
      </form>
    </main>
  );
}

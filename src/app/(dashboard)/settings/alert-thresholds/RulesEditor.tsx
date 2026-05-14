"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { Database } from "@/types/database.types";
import { saveRoutingRulesAction } from "./actions";

type RouteAction = Database["public"]["Enums"]["route_action"];

export type EditorRow = {
  itemKey: string;
  itemValue: string;
  label: string;
  currentRoute: RouteAction;
  parentRoute: RouteAction | null; // null for Default tier
};

export type EditorGroup = {
  title: string;
  rows: ReadonlyArray<EditorRow>;
};

export type EditorProps = {
  procedureType: string | null;
  surgeonId: string | null;
  procedureOptions: ReadonlyArray<string>;
  surgeonOptions: ReadonlyArray<{ id: string; name: string }>;
  groups: ReadonlyArray<EditorGroup>;
  tier: "default" | "procedure" | "surgeon" | "procedure_surgeon";
  procedureLabel: string | null;
  surgeonLabel: string | null;
  saved: boolean;
};

const ROUTES: ReadonlyArray<RouteAction> = ["off", "yellow", "orange", "red"];

const PILL_STYLES: Record<
  RouteAction,
  { active: string; inactive: string; label: string }
> = {
  off: {
    active: "bg-fv-bg-soft text-fv-text-primary border-fv-text-secondary",
    inactive: "bg-white text-fv-text-secondary border-fv-bg-soft",
    label: "Off",
  },
  yellow: {
    active: "bg-yellow-400 text-yellow-950 border-yellow-500",
    inactive: "bg-white text-yellow-800 border-yellow-200",
    label: "Yellow",
  },
  orange: {
    active: "bg-orange-500 text-white border-orange-600",
    inactive: "bg-white text-orange-700 border-orange-200",
    label: "Orange",
  },
  red: {
    active: "bg-red-600 text-white border-red-700",
    inactive: "bg-white text-red-700 border-red-200",
    label: "Red",
  },
};

const TIER_BOX: Record<EditorProps["tier"], { bg: string; border: string }> = {
  default: { bg: "bg-fv-bg-soft", border: "border-fv-text-secondary" },
  procedure: { bg: "bg-blue-50", border: "border-blue-400" },
  surgeon: { bg: "bg-purple-50", border: "border-purple-400" },
  procedure_surgeon: { bg: "bg-amber-50", border: "border-amber-500" },
};

export function RulesEditor(props: EditorProps) {
  const router = useRouter();
  const params = useSearchParams();

  // State: rulekey -> chosen route. Initialized from currentRoute.
  const [routes, setRoutes] = useState<Map<string, RouteAction>>(() => {
    const m = new Map<string, RouteAction>();
    for (const g of props.groups) {
      for (const r of g.rows) {
        m.set(`${r.itemKey}|${r.itemValue}`, r.currentRoute);
      }
    }
    return m;
  });

  function setRoute(key: string, value: RouteAction) {
    setRoutes((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  }

  function navigateScope(procedure: string | null, surgeon: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (procedure) sp.set("procedure", procedure);
    else sp.delete("procedure");
    if (surgeon) sp.set("surgeon", surgeon);
    else sp.delete("surgeon");
    sp.delete("saved");
    router.push(`/settings/alert-thresholds?${sp.toString()}`);
  }

  function isOverride(row: EditorRow): boolean {
    const v = routes.get(`${row.itemKey}|${row.itemValue}`);
    if (row.parentRoute === null) return false; // Default tier — n/a
    return v !== row.parentRoute;
  }

  const tierBox = TIER_BOX[props.tier];

  const infoText: Record<EditorProps["tier"], string> = {
    default:
      "Clinic-wide default. Every patient routes through these rules unless a more-specific ruleset overrides a particular row.",
    procedure: `Procedure-only override for ${props.procedureLabel ?? "—"}. Any row left at the parent value falls back to Default.`,
    surgeon: `Surgeon-only override for ${props.surgeonLabel ?? "—"}'s patients. Any row left at the parent value falls back to Default.`,
    procedure_surgeon: `Most specific: ${props.procedureLabel} × ${props.surgeonLabel}. Per-rule fallback walks ${props.surgeonLabel} → ${props.procedureLabel} → Default for any row left at the parent value.`,
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Alert thresholds
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Configure routing rules per (procedure × surgeon). Most severe wins
          across answers; Red is staff-only — patient sees Orange.
        </p>
      </div>

      {/* Scope dropdowns */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
            Procedure
          </span>
          <select
            value={props.procedureType ?? ""}
            onChange={(e) => navigateScope(e.target.value || null, props.surgeonId)}
            className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-sm"
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
            onChange={(e) => navigateScope(props.procedureType, e.target.value || null)}
            className="rounded-md border border-fv-bg-soft bg-white px-3 py-2 text-sm"
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

      {/* Info box — colour reflects tier specificity */}
      <div
        className={`mb-6 rounded-xl border-l-4 ${tierBox.bg} ${tierBox.border} px-4 py-3 text-sm text-fv-text-primary`}
      >
        {infoText[props.tier]}
      </div>

      {props.saved ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Saved.
        </p>
      ) : null}

      <form action={saveRoutingRulesAction} className="space-y-6">
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

        {props.groups.map((group) => (
          <section
            key={group.title}
            className="rounded-xl bg-fv-bg-card p-5 shadow-sm"
          >
            <h2 className="mb-3 text-sm font-semibold text-fv-text-primary">
              {group.title}
            </h2>
            <ul className="divide-y divide-fv-bg-soft">
              {group.rows.map((row) => {
                const key = `${row.itemKey}|${row.itemValue}`;
                const value = routes.get(key) ?? row.currentRoute;
                const override = isOverride(row);
                return (
                  <li key={key} className="flex items-center gap-3 py-2">
                    <span className="flex-1 text-sm text-fv-text-primary">
                      {row.label}
                      {override ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          override
                        </span>
                      ) : null}
                    </span>
                    <div className="inline-flex overflow-hidden rounded-md border border-fv-bg-soft">
                      {ROUTES.map((r) => {
                        const styles = PILL_STYLES[r];
                        const isActive = value === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRoute(key, r)}
                            className={`border-l first:border-l-0 ${styles.active.split(" ")[2] ?? ""} px-3 py-1 text-xs font-semibold transition-colors ${
                              isActive ? styles.active : styles.inactive
                            }`}
                          >
                            {styles.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Hidden inputs the server action consumes */}
                    <input
                      type="hidden"
                      name={`route:${row.itemKey}:${row.itemValue}`}
                      value={value}
                    />
                    {row.parentRoute !== null ? (
                      <input
                        type="hidden"
                        name={`parent:${row.itemKey}:${row.itemValue}`}
                        value={row.parentRoute}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            className="rounded-md bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white"
          >
            Save changes
          </button>
        </div>
      </form>
    </main>
  );
}

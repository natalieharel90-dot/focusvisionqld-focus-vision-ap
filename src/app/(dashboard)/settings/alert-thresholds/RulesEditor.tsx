"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { Database } from "@/types/database.types";
import { saveRoutingRulesAction } from "./actions";

type RouteAction = Database["public"]["Enums"]["route_action"];
type Tier = "default" | "procedure" | "surgeon" | "procedure_surgeon";

export type EditorRow = {
  itemKey: string;
  itemValue: string;
  label: string;
  currentRoute: RouteAction;
  parentRoute: RouteAction | null;
};

export type EditorGroup = {
  kind: "level" | "vision" | "symptoms";
  title: string;
  subtitle: string;
  rows: ReadonlyArray<EditorRow>;
};

export type EditorProps = {
  procedureType: string | null;
  surgeonId: string | null;
  procedureOptions: ReadonlyArray<string>;
  surgeonOptions: ReadonlyArray<{ id: string; name: string }>;
  procedureOverrideCounts: Record<string, number>;
  surgeonOverrideCounts: Record<string, number>;
  groups: ReadonlyArray<EditorGroup>;
  tier: Tier;
  procedureLabel: string | null;
  surgeonLabel: string | null;
  saved: boolean;
  canEdit: boolean;
};

const ROUTES: ReadonlyArray<RouteAction> = ["off", "yellow", "orange", "red"];

const ROUTE_INFO: Record<
  RouteAction,
  { label: string; dot: string; fill: string; text: string; blurb: string }
> = {
  off: {
    label: "Off",
    dot: "#B8C7C2",
    fill: "#6B7C77",
    text: "#FFFFFF",
    blurb: "no flag",
  },
  yellow: {
    label: "Yellow",
    dot: "#D8A82A",
    fill: "#D8A82A",
    text: "#3D2F00",
    blurb: "patient sees Yellow, staff reviews within 4h",
  },
  orange: {
    label: "Orange",
    dot: "#D67E3B",
    fill: "#D67E3B",
    text: "#FFFFFF",
    blurb: "patient sees Orange, staff contacts today",
  },
  red: {
    label: "Red",
    dot: "#C13434",
    fill: "#C13434",
    text: "#FFFFFF",
    blurb: "patient sees Orange (calming), staff get urgent alert immediately",
  },
};

const INFO_BOX: Record<Tier, { bg: string; border: string; title: string }> = {
  default: { bg: "#E0F2EC", border: "#A8D5C5", title: "#2E7A66" },
  procedure: { bg: "#FFF6DF", border: "#E8D7A8", title: "#9A7A14" },
  surgeon: { bg: "#E0EBEE", border: "#A8C8D0", title: "#2C7585" },
  procedure_surgeon: { bg: "#FCEFF6", border: "#F4C0D6", title: "#B83069" },
};

// Presentational scale label + description per check-in level.
const PAIN_META: ReadonlyArray<{ scale: string; desc: string }> = [
  { scale: "None", desc: "No pain" },
  { scale: "Mild", desc: "Barely noticeable" },
  { scale: "Mild", desc: "Noticeable but manageable" },
  { scale: "Moderate", desc: "Higher than expected" },
  { scale: "Severe", desc: "Concerning" },
  { scale: "Severe", desc: "Patient distressed" },
];
const LIGHT_META: ReadonlyArray<{ scale: string; desc: string }> = [
  { scale: "None", desc: "No light sensitivity" },
  { scale: "Mild", desc: "Expected post-op" },
  { scale: "Mild", desc: "Within expected range" },
  { scale: "Moderate", desc: "Patient avoiding bright environments" },
  { scale: "Severe", desc: "Patient uncomfortable indoors" },
  { scale: "Severe", desc: "Can't tolerate any light" },
];
const VISION_META: Record<string, { label: string; desc: string }> = {
  better: { label: "Better", desc: "Reassuring" },
  same: { label: "Same", desc: "Stable (expected most days)" },
  worse: { label: "Worse", desc: "After Day 3 (varies by procedure)" },
};
const SYMPTOM_DESC: Record<string, string> = {
  "Floaters (specks in vision)": "New onset is concerning post-op",
  "Flashes of light": "Possible retinal traction — always escalate",
  "Discharge from eye": "Possible infection signal",
  "Increased redness":
    "Some redness is expected; 'increased' warrants review",
  "Sudden vision changes": "Always escalate",
  "Severe pain": "Patient self-reports beyond expected discomfort",
  "Increased blurriness": "Some fluctuation is expected in week 1",
  "Halos or glare (new or worse)":
    "Common in LASIK weeks 1–4; less expected post-cataract",
  "Eye stuck shut on waking":
    "Mild crusting is normal; combine with discharge for review",
  "Excessive watering": "Often normal — Yellow as a safety net",
};

function RoutePills({
  value,
  onChange,
  disabled,
}: {
  value: RouteAction;
  onChange: (r: RouteAction) => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-fv-border">
      {ROUTES.map((r, i) => {
        const info = ROUTE_INFO[r];
        const active = value === r;
        return (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r)}
            className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              disabled ? "cursor-default" : ""
            } ${i > 0 ? "border-l border-fv-border" : ""}`}
            style={
              active
                ? { background: info.fill, color: info.text }
                : { background: "#FFFFFF", color: "#5C7178" }
            }
          >
            {info.label}
          </button>
        );
      })}
    </div>
  );
}

const labelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary";
const selectClass =
  "mt-1 w-full rounded-lg border border-fv-border bg-fv-bg-app px-3 py-2 text-sm text-fv-text-primary focus:border-fv-accent focus:outline-none";

export function RulesEditor(props: EditorProps) {
  const router = useRouter();
  const params = useSearchParams();

  const initialRoutes = useMemo(() => {
    const m = new Map<string, RouteAction>();
    for (const g of props.groups)
      for (const r of g.rows)
        m.set(`${r.itemKey}|${r.itemValue}`, r.currentRoute);
    return m;
  }, [props.groups]);

  const [routes, setRoutes] = useState<Map<string, RouteAction>>(initialRoutes);
  // Picker state — drives the live info box; changing it also navigates.
  const [proc, setProc] = useState<string>(props.procedureType ?? "");
  const [surg, setSurg] = useState<string>(props.surgeonId ?? "");

  function setRoute(key: string, value: RouteAction) {
    setRoutes((prev) => new Map(prev).set(key, value));
  }

  function navigateScope(procedure: string, surgeon: string) {
    const sp = new URLSearchParams(params.toString());
    if (procedure) sp.set("procedure", procedure);
    else sp.delete("procedure");
    if (surgeon) sp.set("surgeon", surgeon);
    else sp.delete("surgeon");
    sp.delete("saved");
    router.push(`/settings/alert-thresholds?${sp.toString()}`);
  }

  // Live tier + labels, derived from the picker state.
  const liveTier: Tier =
    proc && surg
      ? "procedure_surgeon"
      : proc
        ? "procedure"
        : surg
          ? "surgeon"
          : "default";
  const procLabel = proc ? proc.toUpperCase() : null;
  const surgLabel = props.surgeonOptions.find((s) => s.id === surg)?.name ?? null;

  const box = INFO_BOX[liveTier];
  const infoTitle: Record<Tier, string> = {
    default: "You are editing the Default ruleset.",
    procedure: `You are editing the ${procLabel} · All surgeons ruleset.`,
    surgeon: `You are editing the All procedures · ${surgLabel} ruleset.`,
    procedure_surgeon: `You are editing the ${procLabel} · ${surgLabel} ruleset.`,
  };
  const infoBody: Record<Tier, string> = {
    default:
      "These rules apply to every patient regardless of procedure or surgeon. Start here — set the routing for each level and symptom below.",
    procedure: `These rules apply to all patients having ${procLabel}, regardless of which surgeon performed it. Use this for procedure-specific recovery patterns (e.g. PRK takes longer than LASIK so 'Vision Worse after Day' might be Day 7 instead of Day 3). If a surgeon wants different rules for their own ${procLabel} patients, pick their name to create a more specific override.`,
    surgeon: `These rules apply to every ${surgLabel} patient regardless of procedure. Use this for a surgeon's personal review preferences. Pick a procedure as well to narrow it to one combination.`,
    procedure_surgeon: `This is the most specific level — ${procLabel} patients of ${surgLabel}. Any row left at the inherited value falls back through ${surgLabel} → ${procLabel} → Default, so override only what truly differs here.`,
  };

  return (
    <>
      {/* Procedure × surgeon picker */}
      <div className="mt-5 grid grid-cols-1 gap-3.5 min-[900px]:grid-cols-2">
        <label>
          <span className={labelClass}>Procedure</span>
          <select
            value={proc}
            onChange={(e) => {
              setProc(e.target.value);
              navigateScope(e.target.value, surg);
            }}
            className={selectClass}
          >
            <option value="">
              ★ Default — applies to every procedure unless overridden
            </option>
            {props.procedureOptions.map((p) => {
              const n = props.procedureOverrideCounts[p] ?? 0;
              return (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                  {n > 0 ? ` · ${n} override${n === 1 ? "" : "s"}` : ""}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          <span className={labelClass}>Surgeon</span>
          <select
            value={surg}
            onChange={(e) => {
              setSurg(e.target.value);
              navigateScope(proc, e.target.value);
            }}
            className={selectClass}
          >
            <option value="">
              ★ Default — applies to every surgeon unless overridden
            </option>
            {props.surgeonOptions.map((s) => {
              const n = props.surgeonOverrideCounts[s.id] ?? 0;
              return (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {n > 0 ? ` · ${n} override${n === 1 ? "" : "s"}` : ""}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {/* Colour-coded info box */}
      <div
        className="mt-3.5 flex gap-3 rounded-[10px] border p-3.5"
        style={{ background: box.bg, borderColor: box.border }}
      >
        <span className="text-lg leading-none" aria-hidden>
          💡
        </span>
        <div>
          <div
            className="text-sm font-semibold"
            style={{ color: box.title }}
          >
            {infoTitle[liveTier]}
          </div>
          <p className="mt-1 text-[13px] text-fv-text-primary">
            {infoBody[liveTier]}
          </p>
          {liveTier === "default" ? (
            <p className="mt-1 text-[11px] text-fv-text-secondary">
              If you later want different routing for a specific procedure,
              surgeon, or combination, change the dropdowns above to create an
              override.
            </p>
          ) : null}
        </div>
      </div>

      {props.saved ? (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Saved.
        </p>
      ) : null}

      {!props.canEdit ? (
        <p className="mt-3 rounded-md bg-fv-bg-soft px-3 py-2 text-sm text-fv-text-secondary">
          You have view-only access to the routing rules. Reception accounts
          can review every ruleset but changes are made by clinical staff and
          managers.
        </p>
      ) : null}

      {/* Routing rules panel */}
      <form
        action={saveRoutingRulesAction}
        className="mt-4 rounded-[14px] border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm"
      >
        <input type="hidden" name="procedure_type" value={proc} />
        <input type="hidden" name="surgeon_id" value={surg} />

        {/* Legend */}
        <div className={labelClass}>
          The four routing options — Off / Yellow / Orange / Red
        </div>
        <div
          className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5 rounded-[10px] border p-3"
          style={{ background: "#FAFCFC", borderColor: "#ECEEEE" }}
        >
          {ROUTES.map((r) => {
            const info = ROUTE_INFO[r];
            return (
              <span key={r} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: info.dot }}
                />
                <span className="font-bold text-fv-text-primary">
                  {info.label}
                </span>
                <span className="text-fv-text-secondary">— {info.blurb}</span>
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-fv-text-secondary">
          If multiple answers fire, the most severe route wins (Red &gt; Orange
          &gt; Yellow &gt; Off). Red is decoupled from what the patient sees —
          they always see Orange&apos;s calming &quot;Let&apos;s have a chat
          today&quot; screen even when staff get a Red urgent alert.
        </p>

        <div className={`${labelClass} mt-6`}>
          Graded items — set the zone for each level independently
        </div>

        {props.groups.map((group) => (
          <Group
            key={group.title}
            group={group}
            routes={routes}
            setRoute={setRoute}
            canEdit={props.canEdit}
          />
        ))}

        {/* Footer explainer */}
        <div
          className="mt-6 rounded-[10px] p-3"
          style={{ background: "#E0EBEE" }}
        >
          <div
            className="text-sm font-semibold"
            style={{ color: "#2C7585" }}
          >
            How procedure × surgeon overrides work
          </div>
          <p className="mt-1 text-[13px] text-fv-text-primary">
            Routing falls back per rule, not per ruleset: any row you leave at
            the inherited value is resolved through surgeon → procedure →
            Default. A row you change here is stored as an override for this
            ruleset only and is marked with a highlighted left border.
          </p>
        </div>

        {props.canEdit ? (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRoutes(new Map(initialRoutes))}
              className="rounded-md border border-fv-border px-4 py-2 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
            >
              Discard changes
            </button>
            <button
              type="submit"
              className="rounded-md bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Save ruleset
            </button>
          </div>
        ) : null}
      </form>
    </>
  );
}

function Group({
  group,
  routes,
  setRoute,
  canEdit,
}: {
  group: EditorGroup;
  routes: Map<string, RouteAction>;
  setRoute: (key: string, value: RouteAction) => void;
  canEdit: boolean;
}) {
  if (group.kind === "symptoms") {
    return (
      <section className="mt-6">
        <div className={labelClass}>
          Unusual symptoms (chips the patient can tap)
        </div>
        <p className="mt-1.5 text-xs text-fv-text-secondary">
          Each symptom routes independently. Use the same four-option router as
          above — Off / Yellow / Orange / Red. Set Red for symptoms where every
          minute counts but the patient shouldn&apos;t be alarmed (patient
          still sees the calming Orange screen; team gets a Red-priority urgent
          alert with SMS + auto-call).
        </p>
        <div
          className="mt-2 flex gap-2 rounded-[10px] p-3 text-xs text-fv-text-secondary"
          style={{ background: "#FAFCFC" }}
        >
          <span style={{ color: "#2E7A66" }} aria-hidden>
            ℹ
          </span>
          <span>
            New symptoms added in the Standard symptom options tab
            automatically appear here with the same four routing options. The
            default for a new symptom is Orange (safer default —
            review-warranted unless you explicitly soften it).
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {group.rows.map((row) => {
            const key = `${row.itemKey}|${row.itemValue}`;
            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-fv-bg-soft px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-fv-text-primary">
                    {row.label}
                  </div>
                  {SYMPTOM_DESC[row.label] ? (
                    <div className="text-[10px] text-fv-text-secondary">
                      {SYMPTOM_DESC[row.label]}
                    </div>
                  ) : null}
                </div>
                <RouteCell
                  row={row}
                  routes={routes}
                  setRoute={setRoute}
                  canEdit={canEdit}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // "level" and "vision" share the table shell.
  const isLight = group.rows[0]?.itemKey === "light_sensitivity";
  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-bold text-fv-text-primary">
          {group.title}
        </span>
        <span className="text-[11px] text-fv-text-secondary">
          {group.subtitle}
        </span>
      </div>
      <div className="mt-1.5 overflow-hidden rounded-[10px] border border-fv-bg-soft">
        {group.rows.map((row, i) => {
          const key = `${row.itemKey}|${row.itemValue}`;
          let scale = "";
          let desc = "";
          let leadLabel = "";
          if (group.kind === "level") {
            const meta = (isLight ? LIGHT_META : PAIN_META)[Number(row.itemValue)];
            scale = meta?.scale ?? "";
            desc = meta?.desc ?? "";
            leadLabel = row.itemValue;
          } else {
            const meta = VISION_META[row.itemValue];
            leadLabel = meta?.label ?? row.label;
            desc = meta?.desc ?? "";
          }
          return (
            <div
              key={key}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 ${
                i > 0 ? "border-t border-fv-bg-soft" : ""
              }`}
            >
              <div className="flex w-[90px] shrink-0 items-baseline gap-1.5">
                <span className="text-sm font-bold text-fv-text-primary">
                  {leadLabel}
                </span>
                {scale ? (
                  <span className="text-[10px] text-fv-text-secondary">
                    {scale}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 text-[11px] text-fv-text-secondary">
                {desc}
              </div>
              <RouteCell
                row={row}
                routes={routes}
                setRoute={setRoute}
                canEdit={canEdit}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// The route pills + the hidden inputs the save action consumes.
function RouteCell({
  row,
  routes,
  setRoute,
  canEdit,
}: {
  row: EditorRow;
  routes: Map<string, RouteAction>;
  setRoute: (key: string, value: RouteAction) => void;
  canEdit: boolean;
}) {
  const key = `${row.itemKey}|${row.itemValue}`;
  const value = routes.get(key) ?? row.currentRoute;
  const override = row.parentRoute !== null && value !== row.parentRoute;
  return (
    <div className="flex items-center gap-2">
      {override ? (
        <span
          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
          title="Overrides the inherited value"
        >
          override
        </span>
      ) : null}
      <RoutePills
        value={value}
        onChange={(r) => setRoute(key, r)}
        disabled={!canEdit}
      />
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
    </div>
  );
}

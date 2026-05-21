"use client";

import { useState } from "react";

import { saveAlertActionsAction } from "../alert-actions/actions";

type Level = "red" | "orange" | "yellow";
type BoolField = "email_clinic" | "inapp_to_all" | "call_surgeon";

export type AlertActionRow = {
  alert_level: Level;
  email_clinic: boolean;
  inapp_to_all: boolean;
  call_surgeon: boolean;
};

type LevelState = {
  email_clinic: boolean;
  inapp_to_all: boolean;
  call_surgeon: boolean;
};

function toState(row: AlertActionRow | undefined): LevelState {
  return {
    email_clinic: row?.email_clinic ?? false,
    inapp_to_all: row?.inapp_to_all ?? false,
    call_surgeon: row?.call_surgeon ?? false,
  };
}

type RowDef = { field: BoolField; title: string; sub: string };

const ACTION_ROWS: ReadonlyArray<RowDef> = [
  {
    field: "email_clinic",
    title: "Email the clinic",
    sub: "Sent to hello@focusvision.com.au with patient name, recovery day, and the symptom summary.",
  },
  {
    field: "inapp_to_all",
    title: "In-app alert to all staff",
    sub: "Appears in the dashboard inbox and on the staff mobile app for anyone on duty.",
  },
  {
    field: "call_surgeon",
    title: "Call the patient's surgeon",
    sub: "Auto-dials the surgeon's number from their staff profile — different surgeons get different numbers.",
  },
];

const CARD: Record<
  Level,
  {
    pill: string;
    pillStyle: React.CSSProperties;
    title: string;
    bg: string;
    border: string;
    copyFrom: Level;
    redNote?: string;
  }
> = {
  red: {
    pill: "Red · Urgent",
    pillStyle: { background: "#C13434", color: "#FFFFFF" },
    title: "Staff-only · patient sees Orange",
    bg: "#FCEAEA",
    border: "#C13434",
    copyFrom: "orange",
    redNote:
      "Triggered by any answer routed to Red. The patient experience is identical to Orange — only the staff side knows it's a Red urgent alert.",
  },
  orange: {
    pill: "Orange zone",
    pillStyle: { background: "#FFE5DA", color: "#B66828" },
    title: "Highest concern · contact today",
    bg: "#FAFCFC",
    border: "#D67E3B",
    copyFrom: "yellow",
  },
  yellow: {
    pill: "Yellow zone",
    pillStyle: { background: "#FFF6DF", color: "#9A7A14" },
    title: "Mid concern · review within 4 hours",
    bg: "#FAFCFC",
    border: "#D8A82A",
    copyFrom: "orange",
  },
};

const LEVEL_ORDER: ReadonlyArray<Level> = ["red", "orange", "yellow"];

export function AlertActionsPanel({ rows }: { rows: AlertActionRow[] }) {
  const byLevel = new Map(rows.map((r) => [r.alert_level, r]));
  const [state, setState] = useState<Record<Level, LevelState>>({
    red: toState(byLevel.get("red")),
    orange: toState(byLevel.get("orange")),
    yellow: toState(byLevel.get("yellow")),
  });

  function update(level: Level, patch: Partial<LevelState>) {
    setState((prev) => ({ ...prev, [level]: { ...prev[level], ...patch } }));
  }

  function copyFrom(target: Level, source: Level) {
    setState((prev) => ({ ...prev, [target]: { ...prev[source] } }));
  }

  return (
    <section className="mt-8">
      <h3 className="text-lg font-semibold text-fv-text-primary">
        Alert actions per zone
      </h3>
      <p className="mt-1 text-[13px] text-fv-text-secondary">
        Three actions, switched on or off per zone: email the clinic
        (hello@focusvision.com.au), raise an in-app alert for all staff,
        and auto-call the patient&apos;s surgeon. The surgeon&apos;s
        number comes from their staff profile so each surgeon is rung on
        their own number.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {LEVEL_ORDER.map((level) => (
          <ZoneCard
            key={level}
            level={level}
            value={state[level]}
            onChange={(patch) => update(level, patch)}
            onCopy={() => copyFrom(level, CARD[level].copyFrom)}
          />
        ))}
      </div>
    </section>
  );
}

function ZoneCard({
  level,
  value,
  onChange,
  onCopy,
}: {
  level: Level;
  value: LevelState;
  onChange: (patch: Partial<LevelState>) => void;
  onCopy: () => void;
}) {
  const card = CARD[level];
  return (
    <form
      action={saveAlertActionsAction}
      className="rounded-[14px] border border-fv-bg-soft p-4"
      style={{ background: card.bg, borderLeft: `4px solid ${card.border}` }}
    >
      <input type="hidden" name="alert_level" value={level} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={card.pillStyle}
          >
            {card.pill}
          </span>
          <span className="text-sm font-bold text-fv-text-primary">
            {card.title}
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-fv-border bg-fv-bg-card px-3 py-1 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
        >
          Copy from{" "}
          {card.copyFrom.charAt(0).toUpperCase() + card.copyFrom.slice(1)}
        </button>
      </div>

      {card.redNote ? (
        <p className="mt-2 text-[11px]" style={{ color: "#871A1A" }}>
          {card.redNote}
        </p>
      ) : null}

      <div className="mt-3">
        {ACTION_ROWS.map((row, i) => (
          <ToggleRow
            key={row.field}
            title={row.title}
            sub={row.sub}
            checked={value[row.field]}
            name={row.field}
            onChange={(v) => onChange({ [row.field]: v })}
            divider={i < ACTION_ROWS.length - 1}
          />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-fv-accent-strong px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          Save {level}
        </button>
      </div>
    </form>
  );
}

function ToggleRow({
  title,
  sub,
  checked,
  name,
  onChange,
  divider,
}: {
  title: string;
  sub: string;
  checked: boolean;
  name?: string;
  onChange: (v: boolean) => void;
  divider: boolean;
}) {
  return (
    <div
      className={`flex gap-3 py-3 ${
        divider ? "border-b border-fv-bg-soft/70" : ""
      }`}
    >
      <Toggle name={name} checked={checked} onChange={onChange} />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-fv-text-primary">
          {title}
        </div>
        <div className="text-[11px] text-fv-text-secondary">{sub}</div>
      </div>
    </div>
  );
}

function Toggle({
  name,
  checked,
  onChange,
}: {
  name?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="h-5 w-9 rounded-full bg-fv-bg-soft transition-colors peer-checked:bg-fv-accent-strong" />
      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
    </label>
  );
}

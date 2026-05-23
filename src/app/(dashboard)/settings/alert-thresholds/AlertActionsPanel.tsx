"use client";

import { useState } from "react";

import { saveAlertActionsAction } from "../alert-actions/actions";

type Level = "red" | "orange" | "yellow";

export type AlertActionRow = {
  alert_level: Level;
  email_clinic: boolean;
  inapp_to_all: boolean;
  override_role_keys: string[];
  include_surgeon_override: boolean;
};

type LevelState = {
  email_clinic: boolean;
  inapp_to_all: boolean;
  override_role_keys: string[];
  include_surgeon_override: boolean;
};

function toState(row: AlertActionRow | undefined): LevelState {
  return {
    email_clinic: row?.email_clinic ?? false,
    inapp_to_all: row?.inapp_to_all ?? false,
    override_role_keys: row?.override_role_keys ?? [],
    include_surgeon_override: row?.include_surgeon_override ?? false,
  };
}

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

export function AlertActionsPanel({
  rows,
  roleOptions,
}: {
  rows: AlertActionRow[];
  roleOptions: string[];
}) {
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
        Three things can fire when a check-in lands in each zone:
        <br />
        <strong>Email</strong> goes to hello@focusvision.com.au.{" "}
        <strong>In-app alert to all staff</strong> raises a notification for
        every active staff member with notifications on.{" "}
        <strong>Override message</strong> pushes specifically to the roles you
        select here — these will bypass staff quiet-hours / off-shift gates
        once those are built. The patient&apos;s own surgeon can also be
        added to the override, but only if the surgeon has opted in
        (Settings → Appearance → After-hours alerts).
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {LEVEL_ORDER.map((level) => (
          <ZoneCard
            key={level}
            level={level}
            value={state[level]}
            roleOptions={roleOptions}
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
  roleOptions,
  onChange,
  onCopy,
}: {
  level: Level;
  value: LevelState;
  roleOptions: string[];
  onChange: (patch: Partial<LevelState>) => void;
  onCopy: () => void;
}) {
  const card = CARD[level];

  function toggleRole(roleName: string, on: boolean) {
    const key = roleName.toLowerCase();
    const next = on
      ? Array.from(new Set([...value.override_role_keys, key]))
      : value.override_role_keys.filter((r) => r !== key);
    onChange({ override_role_keys: next });
  }

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

      <div className="mt-3 flex flex-col gap-3">
        <ToggleRow
          title="Email the clinic"
          sub="Sent to hello@focusvision.com.au with patient name, recovery day, and the symptom summary."
          checked={value.email_clinic}
          name="email_clinic"
          onChange={(v) => onChange({ email_clinic: v })}
        />
        <ToggleRow
          title="In-app alert to all staff"
          sub="Push notification to every active staff member with notifications on."
          checked={value.inapp_to_all}
          name="inapp_to_all"
          onChange={(v) => onChange({ inapp_to_all: v })}
        />

        {/* Override message — role multiselect */}
        <div className="rounded-lg bg-white/40 p-3">
          <div className="text-[13px] font-semibold text-fv-text-primary">
            Override message to selected roles
          </div>
          <div className="text-[11px] text-fv-text-secondary">
            Push goes to anyone in these roles regardless of staff
            quiet-hours / off-shift gating (once those are built). Leave
            empty to send no override.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {roleOptions.length === 0 ? (
              <span className="text-[11px] text-fv-text-secondary">
                No staff roles defined yet. Add them in Settings → Clinic
                &amp; Doctors.
              </span>
            ) : (
              roleOptions.map((roleName) => {
                const key = roleName.toLowerCase();
                const checked = value.override_role_keys.includes(key);
                return (
                  <label
                    key={roleName}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
                      checked
                        ? "border-fv-accent-strong bg-fv-accent-strong text-white"
                        : "border-fv-border bg-fv-bg-card text-fv-text-primary hover:bg-fv-bg-soft"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="override_role_keys"
                      value={key}
                      checked={checked}
                      onChange={(e) => toggleRole(roleName, e.target.checked)}
                      className="sr-only"
                    />
                    {roleName}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <ToggleRow
          title="Include the patient's own surgeon in the override"
          sub="Adds the patient's specific surgeon to the override push (in addition to whatever roles are selected above) — only if that surgeon has opted in via Settings → Appearance → After-hours alerts."
          checked={value.include_surgeon_override}
          name="include_surgeon_override"
          onChange={(v) => onChange({ include_surgeon_override: v })}
        />
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
}: {
  title: string;
  sub: string;
  checked: boolean;
  name?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-3">
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

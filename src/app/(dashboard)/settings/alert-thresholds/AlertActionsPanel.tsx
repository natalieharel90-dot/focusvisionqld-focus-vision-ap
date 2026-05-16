"use client";

import { useState } from "react";

import { saveAlertActionsAction } from "../alert-actions/actions";

type Level = "red" | "orange" | "yellow";
type BoolField =
  | "email_clinic"
  | "inapp_to_all"
  | "push_to_oncall"
  | "sms_oncall"
  | "autocall_oncall";

export type AlertActionRow = {
  alert_level: Level;
  email_clinic: boolean;
  inapp_to_all: boolean;
  push_to_oncall: boolean;
  sms_oncall: boolean;
  autocall_oncall: boolean;
  additional_email: string | null;
  oncall_number: string | null;
};

type LevelState = {
  email_clinic: boolean;
  inapp_to_all: boolean;
  push_to_oncall: boolean;
  sms_oncall: boolean;
  autocall_oncall: boolean;
  additionalOn: boolean;
  additional_email: string;
  oncall_number: string;
};

function toState(row: AlertActionRow | undefined): LevelState {
  return {
    email_clinic: row?.email_clinic ?? false,
    inapp_to_all: row?.inapp_to_all ?? false,
    push_to_oncall: row?.push_to_oncall ?? false,
    sms_oncall: row?.sms_oncall ?? false,
    autocall_oncall: row?.autocall_oncall ?? false,
    additionalOn: !!row?.additional_email,
    additional_email: row?.additional_email ?? "",
    oncall_number: row?.oncall_number ?? "",
  };
}

type RowDef = { field: BoolField; title: string; sub: string };

const CARD: Record<
  Level,
  {
    pill: string;
    pillStyle: React.CSSProperties;
    title: string;
    bg: string;
    border: string;
    copyFrom: Level;
    rows: RowDef[];
    hasAdditional: boolean;
  }
> = {
  red: {
    pill: "Red · Urgent",
    pillStyle: { background: "#C13434", color: "#FFFFFF" },
    title: "Staff-only · patient sees Orange",
    bg: "#FCEAEA",
    border: "#C13434",
    copyFrom: "orange",
    hasAdditional: false,
    rows: [
      {
        field: "email_clinic",
        title: "Email the clinic (with URGENT subject line)",
        sub: "Email subject prefixed with [URGENT] so it stands out in the inbox",
      },
      {
        field: "inapp_to_all",
        title: "In-app alert to all staff (red banner)",
        sub: "Distinct red colour treatment so it can't be mistaken for an Orange flag",
      },
      {
        field: "push_to_oncall",
        title: "Push to on-call staff (overrides quiet hours)",
        sub: "Highest-priority push notification with attention sound",
      },
      {
        field: "sms_oncall",
        title: "SMS the on-call number",
        sub: "Brief SMS with patient name, recovery day, and symptom summary",
      },
      {
        field: "autocall_oncall",
        title: "Auto phone call to on-call number",
        sub: "Auto-dials and plays 'Focus Vision urgent — Red alert — please open the app immediately'",
      },
    ],
  },
  orange: {
    pill: "Orange zone",
    pillStyle: { background: "#FFE5DA", color: "#B66828" },
    title: "Highest concern · contact today",
    bg: "#FAFCFC",
    border: "#D67E3B",
    copyFrom: "yellow",
    hasAdditional: true,
    rows: [
      {
        field: "email_clinic",
        title: "Email the clinic",
        sub: "Sent to info@focusvision.com.au (from Clinic & Staff)",
      },
      {
        field: "inapp_to_all",
        title: "In-app alert to all staff",
        sub: "Appears in everyone's Messages and on the Staff mobile app",
      },
      {
        field: "push_to_oncall",
        title: "Push to on-call staff (overrides quiet hours)",
        sub: "Bypasses individual quiet-hour settings for whoever is on the on-call rota",
      },
      {
        field: "sms_oncall",
        title: "SMS the on-call number",
        sub: "Brief SMS to the on-call number when this zone fires",
      },
      {
        field: "autocall_oncall",
        title: "Auto phone call to on-call number",
        sub: "Uses the same on-call number above. The call plays an automated message: 'Focus Vision urgent alert — patient flagged Orange — please open the app'. Use sparingly.",
      },
    ],
  },
  yellow: {
    pill: "Yellow zone",
    pillStyle: { background: "#FFF6DF", color: "#9A7A14" },
    title: "Mid concern · review within 4 hours",
    bg: "#FAFCFC",
    border: "#D8A82A",
    copyFrom: "orange",
    hasAdditional: true,
    rows: [
      {
        field: "email_clinic",
        title: "Email the clinic",
        sub: "Sent to info@focusvision.com.au (from Clinic & Staff)",
      },
      {
        field: "inapp_to_all",
        title: "In-app alert to all staff",
        sub: "Off by default — Yellow flags review within 4 hours, not urgent",
      },
      {
        field: "push_to_oncall",
        title: "Push to on-call staff (overrides quiet hours)",
        sub: "Off by default — Yellow doesn't typically warrant waking the on-call nurse",
      },
      {
        field: "sms_oncall",
        title: "SMS the on-call number",
        sub: "Brief SMS to the on-call number when this zone fires",
      },
      {
        field: "autocall_oncall",
        title: "Auto phone call to on-call number",
        sub: "Off by default — reserved for Orange and Red",
      },
    ],
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
        Configure exactly what happens when a patient lands in each zone —
        automatically or via manual flag. Mix and match as your clinic prefers.
        The three levels share the same configurable options; the defaults
        below reflect common practice but everything is editable.
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
          Copy from {card.copyFrom.charAt(0).toUpperCase() + card.copyFrom.slice(1)}
        </button>
      </div>

      {level === "red" ? (
        <p className="mt-2 text-[11px]" style={{ color: "#871A1A" }}>
          Triggered by any answer with its routing set to Red in the rules
          above. The patient experience is identical to Orange (calming
          &quot;Let&apos;s have a chat today&quot; screen) — only the staff
          side knows it&apos;s a Red urgent alert. Use the strongest alert
          actions here.
        </p>
      ) : null}

      <div className="mt-3">
        {card.rows.map((row, i) => (
          <ToggleRow
            key={row.field}
            title={row.title}
            sub={row.sub}
            checked={value[row.field]}
            name={row.field}
            onChange={(v) => onChange({ [row.field]: v })}
            divider={i < card.rows.length - 1 || card.hasAdditional}
          >
            {row.field === "sms_oncall" && value.sms_oncall ? (
              <div className="mt-1.5">
                <label className="text-[11px] font-medium text-fv-text-secondary">
                  Number:{" "}
                  <input
                    type="tel"
                    name="oncall_number"
                    value={value.oncall_number}
                    onChange={(e) =>
                      onChange({ oncall_number: e.target.value })
                    }
                    placeholder="+61…"
                    className="ml-1 w-40 rounded-md border border-fv-border bg-fv-bg-card px-2 py-1 text-xs text-fv-text-primary"
                  />
                </label>
                <span className="ml-2 text-[11px] text-fv-text-secondary">
                  ~5¢ per SMS via Twilio
                </span>
              </div>
            ) : null}
          </ToggleRow>
        ))}

        {/* oncall_number is always submitted so it survives an SMS toggle-off. */}
        {!value.sms_oncall ? (
          <input type="hidden" name="oncall_number" value={value.oncall_number} />
        ) : null}

        {card.hasAdditional ? (
          <ToggleRow
            title="Email an additional recipient"
            sub="Useful if a specific person (Nurse Manager, Practice Manager) should also be alerted for these flags"
            checked={value.additionalOn}
            onChange={(v) => onChange({ additionalOn: v })}
            divider={false}
          >
            {value.additionalOn ? (
              <input
                type="email"
                name="additional_email"
                value={value.additional_email}
                onChange={(e) => onChange({ additional_email: e.target.value })}
                placeholder="name@example.com"
                className="mt-1.5 w-64 max-w-full rounded-md border border-fv-border bg-fv-bg-card px-2 py-1 text-xs text-fv-text-primary"
              />
            ) : (
              <input type="hidden" name="additional_email" value="" />
            )}
          </ToggleRow>
        ) : (
          <input type="hidden" name="additional_email" value="" />
        )}
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
  children,
}: {
  title: string;
  sub: string;
  checked: boolean;
  name?: string;
  onChange: (v: boolean) => void;
  divider: boolean;
  children?: React.ReactNode;
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
        {children}
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

"use client";

import { useState } from "react";

import { saveAnalyticsSettingsAction } from "./actions";

type Targets = {
  checkin_completion_pct: number;
  medication_adherence_pct: number;
  staff_response_hours: number;
  red_alert_rate_pct: number;
};

type Props = {
  targets: Targets;
  cardOrder: string[];
  cardLabels: Record<string, string>;
  qs: string;
};

const numberCls =
  "w-20 rounded-lg border border-fv-bg-soft bg-fv-bg-app px-2.5 py-1.5 text-sm focus:border-fv-accent focus:outline-none";

// The analytics Edit modal — adjust clinic-wide target percentages and
// reorder the eight quick-view stat cards. Client component because the
// reorder list and the open/closed state are interactive.
export function AnalyticsSettings({
  targets,
  cardOrder,
  cardLabels,
  qs,
}: Props) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(cardOrder);

  function move(index: number, delta: number) {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOrder(cardOrder);
          setOpen(true);
        }}
        className="rounded-lg border border-fv-border px-4 py-2 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
      >
        Edit
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-fv-bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-fv-text-primary">
              Customise analytics
            </h2>
            <p className="mt-1 text-xs text-fv-text-secondary">
              Targets are clinic-wide. The card order is yours alone.
            </p>

            <form action={saveAnalyticsSettingsAction} className="mt-4">
              <input type="hidden" name="qs" value={qs} />
              <input type="hidden" name="card_order" value={order.join(",")} />

              {/* Targets */}
              <h3 className="text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
                Target percentages
              </h3>
              <div className="mt-2 flex flex-col gap-2.5">
                <label className="flex items-center justify-between text-sm">
                  <span className="text-fv-text-primary">
                    Check-in completion
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      name="checkin_completion_pct"
                      min={0}
                      max={100}
                      defaultValue={targets.checkin_completion_pct}
                      className={numberCls}
                    />
                    <span className="text-fv-text-secondary">%</span>
                  </span>
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span className="text-fv-text-primary">
                    Medication adherence
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      name="medication_adherence_pct"
                      min={0}
                      max={100}
                      defaultValue={targets.medication_adherence_pct}
                      className={numberCls}
                    />
                    <span className="text-fv-text-secondary">%</span>
                  </span>
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span className="text-fv-text-primary">
                    Median staff response
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      name="staff_response_hours"
                      min={0}
                      step={0.5}
                      defaultValue={targets.staff_response_hours}
                      className={numberCls}
                    />
                    <span className="text-fv-text-secondary">h</span>
                  </span>
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span className="text-fv-text-primary">Red alert rate</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      name="red_alert_rate_pct"
                      min={0}
                      max={100}
                      defaultValue={targets.red_alert_rate_pct}
                      className={numberCls}
                    />
                    <span className="text-fv-text-secondary">%</span>
                  </span>
                </label>
              </div>

              {/* Card order */}
              <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-fv-text-secondary">
                Stat card order
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {order.map((key, i) => (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-fv-bg-soft px-3 py-2 text-sm"
                  >
                    <span className="text-fv-text-primary">
                      {cardLabels[key] ?? key}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="rounded-md border border-fv-border px-2 py-0.5 text-xs font-semibold text-fv-text-primary disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === order.length - 1}
                        aria-label="Move down"
                        className="rounded-md border border-fv-border px-2 py-0.5 text-xs font-semibold text-fv-text-primary disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-fv-border px-4 py-2 text-sm font-medium text-fv-text-primary hover:bg-fv-bg-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-fv-accent-strong px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

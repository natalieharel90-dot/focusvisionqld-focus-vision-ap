"use client";

import { useRef } from "react";

import {
  updateOnShiftAction,
  updateStaffQuietHoursAction,
} from "@/app/(dashboard)/settings/appearance/shift-actions";
import { toggleNotificationPrefAction } from "@/app/(dashboard)/inbox/actions";

// Auto-saving toggle for "I'm on shift".
export function OnShiftToggle({ initial }: { initial: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={updateOnShiftAction}>
      <button
        type="button"
        role="switch"
        aria-checked={initial}
        onClick={() => {
          const next = !initial;
          (ref.current!.elements.namedItem("on_shift") as HTMLInputElement).value =
            next ? "on" : "";
          ref.current?.requestSubmit();
        }}
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          initial ? "justify-end bg-fv-accent-strong" : "justify-start bg-fv-bg-soft"
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow" />
      </button>
      <input type="hidden" name="on_shift" defaultValue={initial ? "on" : ""} />
    </form>
  );
}

// Auto-saving toggle for the "new patient message" push preference,
// stored on staff_notification_prefs.
export function NewMessageToggle({ initial }: { initial: boolean }) {
  return (
    <form action={toggleNotificationPrefAction}>
      <input type="hidden" name="pref" value="notify_new_message" />
      <input type="hidden" name="enabled" value={(!initial).toString()} />
      <button
        type="submit"
        role="switch"
        aria-checked={initial}
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          initial ? "justify-end bg-fv-accent-strong" : "justify-start bg-fv-bg-soft"
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow" />
      </button>
    </form>
  );
}

// Quiet-hours editor card: enable toggle + from/to times + per-level
// override checkboxes. All saved together when the user taps Save.
export function QuietHoursCard({
  enabled,
  start,
  end,
  overrideOrange,
  overrideRed,
}: {
  enabled: boolean;
  start: string;
  end: string;
  overrideOrange: boolean;
  overrideRed: boolean;
}) {
  return (
    <form
      action={updateStaffQuietHoursAction}
      className="flex flex-col gap-3 px-4 py-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fv-text-primary">
            Quiet hours
          </div>
          <div className="text-xs text-fv-text-secondary">
            No general push within this window
          </div>
        </div>
        <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            name="quiet_hours"
            defaultChecked={enabled}
            className="peer sr-only"
          />
          <span className="h-6 w-11 rounded-full bg-fv-bg-soft transition-colors peer-checked:bg-fv-accent-strong" />
          <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fv-text-secondary">
            From
          </span>
          <input
            type="time"
            name="quiet_hours_start"
            defaultValue={start}
            className="rounded-lg border border-fv-border bg-fv-bg-app px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fv-text-secondary">
            To
          </span>
          <input
            type="time"
            name="quiet_hours_end"
            defaultValue={end}
            className="rounded-lg border border-fv-border bg-fv-bg-app px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="flex flex-col gap-2 rounded-lg bg-fv-bg-app/60 p-3">
        <div className="text-xs font-semibold text-fv-text-primary">
          Still ring through quiet hours for…
        </div>
        <label className="flex items-center gap-2 text-sm text-fv-text-primary">
          <input
            type="checkbox"
            name="quiet_hours_override_orange"
            defaultChecked={overrideOrange}
            className="h-4 w-4 accent-fv-accent-strong"
          />
          🟠 Orange alerts
        </label>
        <label className="flex items-center gap-2 text-sm text-fv-text-primary">
          <input
            type="checkbox"
            name="quiet_hours_override_red"
            defaultChecked={overrideRed}
            className="h-4 w-4 accent-fv-accent-strong"
          />
          🔴 Red alerts
        </label>
      </div>
      <button
        type="submit"
        className="self-end rounded-lg bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
      >
        Save quiet hours
      </button>
    </form>
  );
}

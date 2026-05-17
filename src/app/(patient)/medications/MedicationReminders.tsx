"use client";

import { useEffect, useState } from "react";

type ReminderDose = {
  id: string;
  scheduled_at: string;
  medication_name: string;
  dose: string;
};

type Props = {
  doses: ReadonlyArray<ReminderDose>;
};

// Foreground notifications via the browser Notification API. While this
// page is open, each upcoming dose gets a setTimeout that fires when
// scheduled_at arrives. True background push (when the app is closed)
// requires a Service Worker + Push API — separate session.
export function MedicationReminders({ doses }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const timers: number[] = [];

    for (const dose of doses) {
      const ms = new Date(dose.scheduled_at).getTime() - now;
      // Skip past doses (already due) and anything more than 24h out.
      // setTimeout is unreliable for very long delays anyway.
      if (ms <= 0 || ms > TWENTY_FOUR_HOURS) continue;

      const timer = window.setTimeout(() => {
        new Notification(`Time for ${dose.medication_name}`, {
          body: `${dose.dose} now`,
          tag: dose.id,
        });
      }, ms);
      timers.push(timer);
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [doses, permission]);

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  if (permission === null) return null; // SSR / no Notification API

  const tile = "grid h-11 w-11 shrink-0 place-items-center rounded-xl";

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-fv-bg-soft/70 p-4">
        <span className={`${tile} bg-fv-bg-accent-soft text-fv-accent-strong`}>
          <BellIcon />
        </span>
        <p className="text-sm text-fv-text-secondary">
          <strong className="text-fv-text-primary">Reminders are on.</strong>{" "}
          We&apos;ll notify you here when each dose is due.
        </p>
      </div>
    );
  }
  if (permission === "denied") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4">
        <span className={`${tile} bg-amber-100 text-amber-700`}>
          <BellOffIcon />
        </span>
        <p className="text-sm text-amber-900">
          <strong>Reminders are blocked.</strong> Enable notifications in your
          browser&apos;s site settings to get dose reminders.
        </p>
      </div>
    );
  }
  // 'default' — not asked yet
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-fv-bg-card p-4 shadow-sm">
      <span className={`${tile} bg-fv-bg-accent-soft text-fv-accent-strong`}>
        <BellIcon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-fv-text-primary">
          Turn on dose reminders
        </div>
        <div className="text-sm text-fv-text-secondary">
          A notification when each dose is due.
        </div>
      </div>
      <button
        type="button"
        onClick={requestPermission}
        className="shrink-0 rounded-full bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
      >
        Turn on
      </button>
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.9 17.9 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

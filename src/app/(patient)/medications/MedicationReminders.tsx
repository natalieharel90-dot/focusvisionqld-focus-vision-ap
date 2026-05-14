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
  if (permission === "granted") {
    return (
      <p className="rounded-md bg-fv-bg-soft px-3 py-2 text-xs text-fv-text-secondary">
        Reminders are on. We&apos;ll notify you here when each dose is due.
      </p>
    );
  }
  if (permission === "denied") {
    return (
      <p className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
        Notifications are blocked. Enable them in your browser&apos;s site
        settings to get medication reminders.
      </p>
    );
  }
  // 'default' — not asked yet
  return (
    <button
      type="button"
      onClick={requestPermission}
      className="rounded-md border border-fv-accent-strong px-3 py-2 text-xs font-semibold text-fv-accent-strong"
    >
      Turn on dose reminders
    </button>
  );
}

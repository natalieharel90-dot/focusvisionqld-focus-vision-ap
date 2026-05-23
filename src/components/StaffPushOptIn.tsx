"use client";

import { useEffect, useState } from "react";

import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/app/(patient)/preferences/push-actions";

// The patient push actions are user-id-scoped now, so the same server
// actions work for staff. The UI copy here is staff-flavoured.

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

type State = "loading" | "unsupported" | "blocked" | "off" | "on" | "working";

export function StaffPushOptIn() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => (reg ? reg.pushManager.getSubscription() : null))
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Notifications aren't set up yet.");
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(key),
        }));
      const json = sub.toJSON();
      const result = await savePushSubscriptionAction({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (!result.ok) throw new Error(result.error ?? "Couldn't save.");
      setState("on");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't turn on notifications."
      );
      setState("off");
    }
  }

  async function disable() {
    setError(null);
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't turn off notifications."
      );
      setState("on");
    }
  }

  async function sendTest() {
    setTestStatus("sending");
    setTestError(null);
    try {
      const result = await sendTestPushAction();
      if (result.ok) setTestStatus("sent");
      else {
        setTestError(result.error ?? "Couldn't send the test.");
        setTestStatus("failed");
      }
    } catch {
      setTestError("Couldn't send the test.");
      setTestStatus("failed");
    }
  }

  return (
    <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-fv-text-primary">
        Alert notifications
      </h2>
      <p className="mt-1 text-sm text-fv-text-secondary">
        Turn on push notifications so you&apos;re alerted on this device when
        a patient check-in lands in a flagged zone or a patient messages the
        clinic. Surgeons: also needed for the auto-call alert to reach you.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {state === "loading" ? (
          <p className="text-sm text-fv-text-secondary">Checking…</p>
        ) : state === "unsupported" ? (
          <p className="text-sm text-fv-text-secondary">
            This device or browser doesn&apos;t support notifications. On
            iPhone, add the app to your home screen and open it from there.
          </p>
        ) : state === "blocked" ? (
          <p className="text-sm text-fv-text-secondary">
            Notifications are blocked. Turn them on for this site in your
            browser or phone settings, then come back here.
          </p>
        ) : state === "on" ? (
          <>
            <p className="text-sm text-emerald-700">
              Notifications are on for this device.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sendTest}
                disabled={testStatus === "sending"}
                className="rounded-md bg-fv-accent-strong px-4 py-1.5 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {testStatus === "sending"
                  ? "Sending…"
                  : "Send a test notification"}
              </button>
              <button
                type="button"
                onClick={disable}
                className="rounded-md border border-fv-border px-4 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
              >
                Turn off
              </button>
            </div>
            {testStatus === "sent" ? (
              <p className="text-xs text-emerald-700">
                Test sent — a notification should arrive on this device.
              </p>
            ) : null}
            {testStatus === "failed" ? (
              <p className="text-xs text-red-600">{testError}</p>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={state === "working"}
            className="self-start rounded-md bg-fv-accent-strong px-4 py-1.5 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {state === "working" ? "Just a moment…" : "Turn on notifications"}
          </button>
        )}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}

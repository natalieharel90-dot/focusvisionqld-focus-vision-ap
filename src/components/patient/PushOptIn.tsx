"use client";

import { useEffect, useState } from "react";

import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/app/(patient)/preferences/push-actions";

// The VAPID public key is a base64url string; the Push API wants the raw
// bytes as the applicationServerKey.
function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

type State =
  | "loading"
  | "unsupported"
  | "blocked"
  | "off"
  | "on"
  | "working";

const card = "rounded-2xl bg-fv-bg-card p-4 shadow-sm";

// Lets the patient turn Web Push notifications on or off for the current
// device. Notification permission and the push subscription are
// per-device browser state, so this can't be a plain saved preference.
export function PushOptIn() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");
  const [testError, setTestError] = useState<string | null>(null);

  async function sendTest() {
    setTestStatus("sending");
    setTestError(null);
    try {
      const result = await sendTestPushAction();
      if (result.ok) {
        setTestStatus("sent");
      } else {
        setTestError(result.error ?? "Couldn't send the test.");
        setTestStatus("failed");
      }
    } catch {
      setTestError("Couldn't send the test.");
      setTestStatus("failed");
    }
  }

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
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
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

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(key),
      });
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
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
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

  if (state === "loading") return null;

  return (
    <div className={`flex flex-col gap-2 ${card}`}>
      <div className="font-semibold text-fv-text-primary">
        Notifications on this device
      </div>

      {state === "unsupported" ? (
        <p className="text-sm text-fv-text-secondary">
          This device or browser doesn&apos;t support notifications.
        </p>
      ) : state === "blocked" ? (
        <p className="text-sm text-fv-text-secondary">
          Notifications are blocked. Turn them on for this site in your
          browser or phone settings, then come back here.
        </p>
      ) : state === "on" ? (
        <>
          <p className="text-sm text-fv-text-secondary">
            You&apos;ll get a notification when your care team messages you.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendTest}
              disabled={testStatus === "sending"}
              className="rounded-xl bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {testStatus === "sending"
                ? "Sending…"
                : "Send a test notification"}
            </button>
            <button
              type="button"
              onClick={disable}
              className="rounded-xl border border-fv-border px-4 py-2 text-sm font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
            >
              Turn off
            </button>
          </div>
          {testStatus === "sent" ? (
            <p className="text-xs text-green-700">
              Test sent — a notification should arrive on this device.
            </p>
          ) : null}
          {testStatus === "failed" ? (
            <p className="text-xs text-red-600">{testError}</p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm text-fv-text-secondary">
            Get a notification on this device when your care team messages
            you.
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={state === "working"}
            className="self-start rounded-xl bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {state === "working" ? "Just a moment…" : "Turn on notifications"}
          </button>
        </>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

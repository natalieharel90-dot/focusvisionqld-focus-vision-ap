"use client";

import { useRef, useState } from "react";

import {
  BONUS_TOAST_DURATION_MS,
  BONUS_UNLOCK_TOAST,
  evaluateUnlockClicks,
} from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  // Server action that persists the unlock for the current user. Patient
  // and staff each pass their own.
  action: () => Promise<{ ok: boolean }>;
  // When set, the unlock is also stashed in localStorage under this key,
  // so an unlock triggered on an unauthenticated screen (the patient
  // sign-in page) can be synced server-side once the user logs in.
  bridgeKey?: string;
};

// Wraps the Focus Vision logo. 13 clicks within 5s attempt to unlock the
// bonus theme pack. Used on the patient app logo and the staff dashboard
// logo. The toast appears only when the unlock actually succeeds — for a
// patient whose staff have not enabled the pack the 13th click is silent
// (the action returns { ok: false }), so the feature stays invisible.
export function LogoUnlockTrigger({ children, action, bridgeKey }: Props) {
  const clicksRef = useRef<number[]>([]);
  const [showToast, setShowToast] = useState(false);

  async function handleClick() {
    const { clicks, unlocked } = evaluateUnlockClicks(
      clicksRef.current,
      Date.now()
    );
    clicksRef.current = clicks;
    if (!unlocked) return;

    clicksRef.current = [];

    if (bridgeKey) {
      try {
        window.localStorage.setItem(bridgeKey, "1");
      } catch {
        // private mode / disabled storage — the server action still runs.
      }
    }

    const result = await action();
    if (!result.ok) return;

    setShowToast(true);
    window.setTimeout(() => setShowToast(false), BONUS_TOAST_DURATION_MS);
  }

  return (
    <>
      <span
        onClick={handleClick}
        className="inline-flex cursor-pointer select-none"
        role="presentation"
      >
        {children}
      </span>
      {showToast ? (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          ✨ {BONUS_UNLOCK_TOAST}
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { unlockBonusPackAction } from "@/app/(patient)/bonus-actions";

const PENDING_KEY = "fv_bonus_unlock";

// Syncs a bonus-pack unlock that happened on the (unauthenticated)
// sign-in screen: if localStorage carries the pending flag and the
// patient isn't unlocked yet, persist it server-side now.
export function BonusUnlockBridge({
  alreadyUnlocked,
}: {
  alreadyUnlocked: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (alreadyUnlocked) return;
    let pending = false;
    try {
      pending = window.localStorage.getItem(PENDING_KEY) === "1";
    } catch {
      pending = false;
    }
    if (!pending) return;

    void unlockBonusPackAction().then((result) => {
      // Clear the flag either way: the patient is authenticated here, so
      // an { ok: false } means they're not eligible — don't keep retrying.
      try {
        window.localStorage.removeItem(PENDING_KEY);
      } catch {
        // ignore
      }
      if (result.ok) router.refresh();
    });
  }, [alreadyUnlocked, router]);

  return null;
}

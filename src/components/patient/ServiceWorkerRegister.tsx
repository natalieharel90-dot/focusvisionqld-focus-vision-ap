"use client";

import { useEffect } from "react";

// Registers the push service worker once, on the patient app. Renders
// nothing. The service worker itself is push-only (see public/sw.js).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[sw] registration failed", err);
    });
  }, []);

  return null;
}

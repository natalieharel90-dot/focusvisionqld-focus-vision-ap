"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// When a page loads carrying an ?error= message, scroll the error banner
// into view. Forms render the banner above their fields, so on a long
// page — or after the user has scrolled down to fill it in — the error
// would otherwise be off-screen. Error banners are the only elements that
// pair the bg-red-50 and text-red-700 classes, so they can be found
// without tagging each one individually.
export function ScrollToErrorOnLoad() {
  const error = useSearchParams().get("error");

  useEffect(() => {
    if (!error) return;
    requestAnimationFrame(() => {
      document
        .querySelector(".bg-red-50.text-red-700")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [error]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";

// An invisible anchor placed at the end of a message list. Whenever the
// message count changes — on first load and after a new message is sent —
// it scrolls itself into view so the newest message is visible without
// the user having to scroll manually.
export function ScrollToLatest({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, [count]);

  return <div ref={ref} aria-hidden className="h-0" />;
}

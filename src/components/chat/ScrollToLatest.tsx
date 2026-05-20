"use client";

import { useLayoutEffect, useRef } from "react";

// On first render and whenever the message count changes, scrolls itself
// into view so the newest message stays visible.
//
// `bottomOffset` is the height (px) of the anchor itself. Pages with a
// sticky composer overlaying the viewport bottom should pass enough
// pixels here to push the anchor — and therefore the last message —
// above the composer when the browser scrolls to "end". Pages whose
// scroll container has its composer outside it (the staff inbox) can
// leave it at 0.
//
// useLayoutEffect runs after DOM updates but before paint so the scroll
// happens without a visible flash.
export function ScrollToLatest({
  count,
  bottomOffset = 0,
}: {
  count: number;
  bottomOffset?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, [count]);

  return <div ref={ref} aria-hidden style={{ height: bottomOffset }} />;
}

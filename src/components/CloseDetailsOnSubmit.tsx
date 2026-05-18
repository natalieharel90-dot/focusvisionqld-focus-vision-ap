"use client";

import { useEffect, useRef } from "react";

// Collapses the surrounding <details> popover once its form is submitted,
// so an "add" dropdown closes itself after the information has been saved.
export function CloseDetailsOnSubmit() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    const details = ref.current?.closest("details");
    if (!form || !details) return;

    function handleSubmit() {
      details!.open = false;
    }
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, []);

  return <span ref={ref} hidden />;
}

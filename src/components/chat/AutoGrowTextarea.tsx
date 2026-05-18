"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

// A textarea that grows to fit its content as the user types, and clears
// itself once the surrounding form is submitted — so the message box
// empties and shrinks back down after a message is sent.
export function AutoGrowTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    resize();
    const el = ref.current;
    const form = el?.form;
    if (!el || !form) return;

    function handleSubmit() {
      // Defer past the submit so the typed text is still captured into
      // the request, then empty the box and shrink it back down.
      requestAnimationFrame(() => {
        el!.value = "";
        resize();
      });
    }
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, []);

  return <textarea ref={ref} {...props} onInput={resize} />;
}

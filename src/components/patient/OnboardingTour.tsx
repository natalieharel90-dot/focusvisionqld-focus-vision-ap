"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { OnboardingOutcome, OnboardingStep } from "@/lib/onboarding";
import { completeOnboardingAction } from "@/app/(patient)/onboarding-actions";

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  steps: ReadonlyArray<OnboardingStep>;
  mode: "first-run" | "replay";
};

// First-run onboarding tour (spec §5.1). A 6-step spotlight: full-screen
// modals open and close it; the middle steps highlight a home tile via a
// box-shadow cutout. Highlight + copy use theme tokens, so it follows the
// patient's theme and dark mode.
export function OnboardingTour({ steps, mode }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [done, setDone] = useState(false);

  const step = steps[index];

  // Measure the highlighted tile on step change, and keep it in sync with
  // scroll / resize so the spotlight stays put.
  useEffect(() => {
    if (!step || step.target === null) {
      setRect(null);
      return;
    }
    const selector = `[data-tour="${step.target}"]`;

    function measure() {
      const el = document.querySelector(selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    document.querySelector(selector)?.scrollIntoView({ block: "center" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  if (done || !step) return null;

  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  async function finish(outcome: OnboardingOutcome) {
    setDone(true);
    const viewedStepKeys = steps.slice(0, index + 1).map((s) => s.key);
    await completeOnboardingAction({ viewedStepKeys, outcome, mode });
    if (mode === "replay") router.replace("/home");
    else router.refresh();
  }

  function next() {
    if (isLast) void finish("completed");
    else setIndex((i) => i + 1);
  }

  const card = (
    <div className="pointer-events-auto w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl bg-fv-bg-card p-4 shadow-xl">
      <p className="text-sm leading-relaxed text-fv-text-primary">
        {step.body}
      </p>
      <div className="mt-3 flex items-center justify-between">
        {isFirst ? (
          <button
            type="button"
            onClick={() => void finish("skipped")}
            className="text-xs font-medium text-fv-text-secondary hover:underline"
          >
            Skip tour
          </button>
        ) : (
          <span className="text-xs text-fv-text-secondary">
            {index + 1} of {steps.length}
          </span>
        )}
        <button
          type="button"
          onClick={next}
          className="rounded-md bg-fv-accent-strong px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );

  // Spotlight step with a measured target.
  if (step.target !== null && rect) {
    return (
      <>
        {/* Click blocker — keeps the page non-interactive during the tour. */}
        <div className="fixed inset-0 z-[60]" aria-hidden />
        {/* Spotlight: accent ring + page-darkening shadow, click-through. */}
        <div
          aria-hidden
          className="pointer-events-none fixed z-[61] rounded-2xl"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow:
              "0 0 0 3px var(--fv-accent-strong), 0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
        <div
          className="pointer-events-none fixed left-1/2 z-[62] -translate-x-1/2 px-5"
          style={{ top: rect.top + rect.height + 14 }}
        >
          {card}
        </div>
      </>
    );
  }

  // Full-screen modal step (welcome / finish), or a fallback if the
  // target tile wasn't found.
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-5">
      {card}
    </div>
  );
}

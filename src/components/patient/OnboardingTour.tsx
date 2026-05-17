"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type {
  OnboardingIcon,
  OnboardingOutcome,
  OnboardingStep,
} from "@/lib/onboarding";
import { completeOnboardingAction } from "@/app/(patient)/onboarding-actions";

type Props = {
  steps: ReadonlyArray<OnboardingStep>;
  mode: "first-run" | "replay";
};

const ICON_PATHS: Record<OnboardingIcon, ReactNode> = {
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" />
  ),
  clipboard: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  pill: (
    <>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  message: (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 12 2.5 2.5 4.5-5.5" />
    </>
  ),
};

function StepIcon({ name }: { name: OnboardingIcon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-14 w-14"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// First-run onboarding (spec §5.1): a full-screen, 5-slide intro carousel.
// Tap the slide (or a dot) to advance; "Skip" exits early. Copy + icon use
// theme tokens, so it follows the patient's theme and dark mode.
export function OnboardingTour({ steps, mode }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  const step = steps[index];
  if (done || !step) return null;

  const isLast = index === steps.length - 1;

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

  return (
    <div className="fixed inset-x-0 top-0 bottom-20 z-50 flex flex-col bg-fv-bg-app px-6">
      <div className="flex justify-end pt-5">
        <button
          type="button"
          onClick={() => void finish("skipped")}
          className="px-2 py-1 text-base font-semibold text-fv-text-secondary"
        >
          Skip
        </button>
      </div>

      {/* Slide — tap anywhere to advance */}
      <div
        role="button"
        tabIndex={0}
        onClick={next}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            next();
          }
        }}
        className="flex flex-1 cursor-pointer flex-col items-center justify-center text-center"
      >
        <span className="grid h-32 w-32 place-items-center rounded-[2rem] bg-gradient-to-br from-fv-accent to-fv-accent-strong text-white shadow-lg">
          <StepIcon name={step.icon} />
        </span>
        <h1 className="mt-9 text-3xl font-bold text-fv-text-primary">
          {step.title}
        </h1>
        <p className="mt-3 max-w-xs text-lg leading-relaxed text-fv-text-secondary">
          {step.body}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pb-6">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-fv-accent-strong" : "w-2 bg-fv-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

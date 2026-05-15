// First-run onboarding tour (spec §5.1) — pure data + helpers. The tour
// is a 6-step spotlight: steps 1 and 6 are full-screen modals, steps 2-5
// highlight one home-screen tile each.

export type OnboardingStep = {
  key: string;
  // data-tour key of the home tile to spotlight; null = full-screen modal.
  target: string | null;
  body: string;
};

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStep> = [
  {
    key: "welcome",
    target: null,
    body: "Welcome to your Focus Vision Recovery Companion. Let's take a quick tour — about 30 seconds.",
  },
  {
    key: "check-in",
    target: "check-in",
    body: "Tap here each day to do your check-in. It takes about 60 seconds and helps us spot anything that needs attention early.",
  },
  {
    key: "medications",
    target: "medications",
    body: "Your medication reminders live here. Tap a dose to mark it taken, or snooze it if you need more time.",
  },
  {
    key: "messages",
    target: "messages",
    body: "Send a message to the Focus Vision team anytime. We usually reply within a few hours during clinic hours.",
  },
  {
    key: "documents",
    target: "documents",
    body: "Your consent forms, surgical paperwork, and check-in history are all here — watermarked with your name for privacy.",
  },
  {
    key: "finish",
    target: null,
    body: "You're set up. We're here whenever you need us.",
  },
];

// The first-run tour fires only for an activated patient who hasn't yet
// completed (or skipped) it. Replays are triggered explicitly and bypass
// this check.
export function shouldShowOnboarding(
  setupStatus: string | null | undefined,
  onboardingCompletedAt: string | null | undefined
): boolean {
  return setupStatus === "activated" && onboardingCompletedAt == null;
}

export type OnboardingOutcome = "completed" | "skipped";

// Audit payload recording which steps the patient saw and how the tour
// ended.
export function buildOnboardingAudit(
  viewedStepKeys: ReadonlyArray<string>,
  outcome: OnboardingOutcome
): { viewed_steps: string[]; steps_viewed: number; outcome: OnboardingOutcome } {
  return {
    viewed_steps: [...viewedStepKeys],
    steps_viewed: viewedStepKeys.length,
    outcome,
  };
}

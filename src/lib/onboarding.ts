// First-run onboarding tour (spec §5.1) — pure data + helpers. The tour
// is a full-screen, 5-slide intro carousel: each slide is an icon, a
// title and a short line of copy.

export type OnboardingIcon =
  | "heart"
  | "clipboard"
  | "pill"
  | "message"
  | "check";

export type OnboardingStep = {
  key: string;
  icon: OnboardingIcon;
  title: string;
  body: string;
};

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStep> = [
  {
    key: "welcome",
    icon: "heart",
    title: "Welcome to Focus Vision",
    body: "We're here to support you through every step of your recovery. This tour takes about 30 seconds — feel free to skip.",
  },
  {
    key: "check-in",
    icon: "clipboard",
    title: "Your daily check-in",
    body: "Each day, a quick 60-second check-in helps us spot anything that needs attention early.",
  },
  {
    key: "medications",
    icon: "pill",
    title: "Medication reminders",
    body: "Your eye-drop schedule lives here. Mark each dose as you take it, or snooze it if you need more time.",
  },
  {
    key: "messages",
    icon: "message",
    title: "Message your care team",
    body: "Reach the Focus Vision team anytime. We usually reply within a couple of hours during clinic hours.",
  },
  {
    key: "finish",
    icon: "check",
    title: "You're all set",
    body: "Everything's ready. We're here whenever you need us — let's get started.",
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

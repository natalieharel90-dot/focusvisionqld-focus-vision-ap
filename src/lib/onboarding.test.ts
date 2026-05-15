import { describe, expect, it } from "vitest";

import {
  ONBOARDING_STEPS,
  buildOnboardingAudit,
  shouldShowOnboarding,
} from "./onboarding";

describe("shouldShowOnboarding — fires on first sign-in only", () => {
  it("fires for an activated patient who hasn't completed it", () => {
    expect(shouldShowOnboarding("activated", null)).toBe(true);
  });

  it("does not re-fire once completed/skipped", () => {
    expect(shouldShowOnboarding("activated", "2026-05-15T09:00:00Z")).toBe(
      false
    );
  });

  it("does not fire before the patient is activated", () => {
    expect(shouldShowOnboarding("awaiting_setup", null)).toBe(false);
    expect(shouldShowOnboarding("partial", null)).toBe(false);
    expect(shouldShowOnboarding(null, null)).toBe(false);
  });
});

describe("ONBOARDING_STEPS", () => {
  it("is a 6-step tour", () => {
    expect(ONBOARDING_STEPS).toHaveLength(6);
  });

  it("opens and closes with full-screen modals (no target)", () => {
    expect(ONBOARDING_STEPS[0]!.target).toBeNull();
    expect(ONBOARDING_STEPS[0]!.key).toBe("welcome");
    expect(ONBOARDING_STEPS[5]!.target).toBeNull();
    expect(ONBOARDING_STEPS[5]!.key).toBe("finish");
  });

  it("steps 2-5 highlight the four home tiles", () => {
    expect(ONBOARDING_STEPS.slice(1, 5).map((s) => s.target)).toEqual([
      "check-in",
      "medications",
      "messages",
      "documents",
    ]);
  });

  it("every step has body copy", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.body.length).toBeGreaterThan(0);
    }
  });
});

describe("buildOnboardingAudit", () => {
  it("records the viewed steps and a completed outcome", () => {
    const payload = buildOnboardingAudit(
      ["welcome", "check-in", "medications", "messages", "documents", "finish"],
      "completed"
    );
    expect(payload.outcome).toBe("completed");
    expect(payload.steps_viewed).toBe(6);
    expect(payload.viewed_steps).toContain("check-in");
  });

  it("records a skipped outcome with the steps seen so far", () => {
    const payload = buildOnboardingAudit(["welcome"], "skipped");
    expect(payload.outcome).toBe("skipped");
    expect(payload.steps_viewed).toBe(1);
  });
});

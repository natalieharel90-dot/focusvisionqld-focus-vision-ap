import { describe, expect, it } from "vitest";

import {
  type FeedbackSection,
  type FeedbackTarget,
  averageRating,
  feedbackRowsToWrite,
  isAcknowledged,
  unacknowledgedFollowUps,
} from "./feedback";

function section(
  target: FeedbackTarget,
  rating: number,
  extra: Partial<FeedbackSection> = {}
): FeedbackSection {
  return {
    target,
    rating,
    comment: "",
    staffMention: "",
    contactRequested: false,
    ...extra,
  };
}

describe("feedbackRowsToWrite — one row per non-empty section", () => {
  it("writes only the sections that were rated", () => {
    const sections = [
      section("clinic", 5),
      section("hospital", 0), // left blank
      section("app", 4),
    ];
    const rows = feedbackRowsToWrite(sections);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.target)).toEqual(["clinic", "app"]);
  });

  it("writes all three when every section is rated", () => {
    expect(
      feedbackRowsToWrite([
        section("clinic", 3),
        section("hospital", 5),
        section("app", 1),
      ])
    ).toHaveLength(3);
  });

  it("writes nothing when no section is rated", () => {
    expect(
      feedbackRowsToWrite([
        section("clinic", 0),
        section("hospital", 0),
        section("app", 0),
      ])
    ).toHaveLength(0);
  });

  it("ignores out-of-range ratings", () => {
    expect(
      feedbackRowsToWrite([section("clinic", 6), section("app", -1)])
    ).toHaveLength(0);
  });
});

describe("averageRating", () => {
  it("averages to one decimal place", () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([5, 5])).toBe(5);
  });

  it("is 0 with no ratings", () => {
    expect(averageRating([])).toBe(0);
  });
});

describe("isAcknowledged", () => {
  it("reflects the acknowledged_at timestamp", () => {
    expect(isAcknowledged({ acknowledged_at: null })).toBe(false);
    expect(
      isAcknowledged({ acknowledged_at: "2026-05-16T09:00:00Z" })
    ).toBe(true);
  });
});

describe("unacknowledgedFollowUps", () => {
  it("counts follow-up requests not yet acknowledged", () => {
    const rows = [
      { contact_requested: true, acknowledged_at: null },
      { contact_requested: true, acknowledged_at: "2026-05-16T09:00:00Z" },
      { contact_requested: false, acknowledged_at: null },
      { contact_requested: true, acknowledged_at: null },
    ];
    expect(unacknowledgedFollowUps(rows)).toBe(2);
  });
});

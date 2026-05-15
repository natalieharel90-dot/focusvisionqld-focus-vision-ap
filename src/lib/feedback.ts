// Patient Feedback (spec §5.9) — pure helpers. A feedback submission has
// up to three sections (clinic / hospital / app); each rated section
// becomes one feedback row.

export type FeedbackTarget = "clinic" | "hospital" | "app";

export const FEEDBACK_TARGETS: ReadonlyArray<{
  key: FeedbackTarget;
  label: string;
}> = [
  { key: "clinic", label: "Focus Vision clinic" },
  { key: "hospital", label: "Hospital" },
  { key: "app", label: "This app" },
];

// One section's worth of form input. rating 0 means the section was left
// blank (not rated).
export type FeedbackSection = {
  target: FeedbackTarget;
  rating: number;
  comment: string;
  staffMention: string; // free text — "e.g. Dr Chen, Nurse Mark"
  contactRequested: boolean;
};

// The sections that should be written as feedback rows — a section counts
// only when the patient gave it a 1-5 star rating.
export function feedbackRowsToWrite(
  sections: ReadonlyArray<FeedbackSection>
): FeedbackSection[] {
  return sections.filter((s) => s.rating >= 1 && s.rating <= 5);
}

// Average star rating to one decimal place (0 when there are no ratings).
export function averageRating(ratings: ReadonlyArray<number>): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((total, r) => total + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function isAcknowledged(feedback: {
  acknowledged_at: string | null;
}): boolean {
  return feedback.acknowledged_at !== null;
}

// Count of follow-up requests still waiting for staff acknowledgement —
// drives the dashboard KPI strip.
export function unacknowledgedFollowUps(
  rows: ReadonlyArray<{ contact_requested: boolean; acknowledged_at: string | null }>
): number {
  return rows.filter((r) => r.contact_requested && r.acknowledged_at === null)
    .length;
}

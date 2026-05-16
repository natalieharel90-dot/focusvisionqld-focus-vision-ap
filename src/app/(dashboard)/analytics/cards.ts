// The eight quick-view stat cards, in their default order. Lives in its
// own module (not actions.ts) because a "use server" file may only
// export async functions.
export const ANALYTICS_CARD_KEYS = [
  "total_patients",
  "new_patients",
  "active_recoveries",
  "app_active_rate",
  "checkins_completed",
  "medication_adherence",
  "median_response",
  "red_alert_rate",
] as const;

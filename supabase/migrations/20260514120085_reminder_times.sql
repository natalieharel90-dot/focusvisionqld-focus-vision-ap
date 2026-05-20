-- Per-patient reminder timing preferences. Every patient's schedule
-- is different, so let them set:
--   • medication_reminder_times — up to 6 evenly-spaced slots that the
--     patient app uses to fill each medication's scheduled_times array
--     (each med uses the first N slots, where N = its frequency).
--   • checkin_reminder_time — replaces the hardcoded 09:00 morning
--     check-in reminder.
--   • checkin_nudge_time — replaces the hardcoded 15:00 nudge for the
--     patients who have the nudge feature on.
--
-- reminder_times_set_at gates the post-onboarding setup screen (null =
-- patient hasn't configured them yet). last_checkin_reminder_at and
-- last_checkin_nudge_at let the cron dedup across consecutive ticks so
-- we don't fire the same reminder multiple times within its window.

alter table public.user_preferences
  add column medication_reminder_times text[] not null default
    array['06:00','09:00','12:00','15:00','18:00','21:00']::text[],
  add column checkin_reminder_time text not null default '09:00',
  add column checkin_nudge_time text not null default '15:00',
  add column reminder_times_set_at timestamptz,
  add column last_checkin_reminder_at timestamptz,
  add column last_checkin_nudge_at timestamptz;

-- HH:MM, 00:00–23:59.
alter table public.user_preferences
  add constraint user_preferences_checkin_time_fmt
    check (checkin_reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add constraint user_preferences_nudge_time_fmt
    check (checkin_nudge_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

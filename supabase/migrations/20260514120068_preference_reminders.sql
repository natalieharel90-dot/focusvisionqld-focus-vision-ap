-- Reminder + accessibility preferences surfaced on the patient Settings
-- screen. Choices are persisted now; notification delivery wiring lands
-- in a later update (same pattern as the existing notify_* columns).
alter table public.user_preferences
  add column snooze_minutes integer not null default 10
    check (snooze_minutes in (5, 10, 15, 30)),
  add column notify_checkin_nudge boolean not null default false,
  add column quiet_hours boolean not null default false,
  add column lock_timezone boolean not null default false,
  add column lock_screen_widget boolean not null default false,
  add column voice_control boolean not null default false;

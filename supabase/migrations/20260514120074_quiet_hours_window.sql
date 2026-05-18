-- Quiet hours used to be a fixed 10 PM – 7 AM window. Let patients set
-- their own start and end times. Stored as "HH:MM" 24-hour text so they
-- round-trip cleanly with the time picker in the patient Settings screen.
alter table public.user_preferences
  add column quiet_hours_start text not null default '22:00',
  add column quiet_hours_end text not null default '07:00';

-- Per-staff appearance preference for the dashboard. Patients store
-- theme in user_preferences; staff aren't patients, so the staff
-- preference lives on staff_users.

alter table public.staff_users
  add column theme text not null default 'calm'
    check (theme in ('calm', 'premium', 'bright', 'terracotta', 'minimal')),
  add column dark_mode boolean not null default false;

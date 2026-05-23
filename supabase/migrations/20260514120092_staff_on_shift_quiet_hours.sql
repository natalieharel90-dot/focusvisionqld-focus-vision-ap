-- Staff-side gates that the alert dispatcher checks before sending the
-- general in-app push:
--   • on_shift — staff member is currently working a shift.
--   • quiet_hours + quiet_hours_start/end — personal quiet window.
--
-- Override pushes (zone_alert_actions.override_role_keys and the
-- per-zone include-surgeon option) intentionally bypass both gates,
-- which is what makes the "override" semantic meaningful.

alter table public.staff_users
  add column on_shift boolean not null default false,
  add column quiet_hours boolean not null default false,
  add column quiet_hours_start text not null default '22:00',
  add column quiet_hours_end text not null default '07:00';

alter table public.staff_users
  add constraint staff_users_quiet_hours_start_fmt
    check (quiet_hours_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add constraint staff_users_quiet_hours_end_fmt
    check (quiet_hours_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

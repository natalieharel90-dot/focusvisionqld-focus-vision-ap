-- Per-staff per-alert-level quiet-hours overrides. Default: orange
-- doesn't override (mid-day push only), red does (always comes
-- through). Staff can flip either.
--
-- Dispatcher reads these in the general in-app push gate alongside
-- staff_users.quiet_hours.

alter table public.staff_users
  add column quiet_hours_override_orange boolean not null default false,
  add column quiet_hours_override_red    boolean not null default true;

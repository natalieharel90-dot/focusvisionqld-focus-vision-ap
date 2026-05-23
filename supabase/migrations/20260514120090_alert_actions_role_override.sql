-- Rework zone_alert_actions to support role-targeted "override" push:
-- when a check-in lands in a flagged zone, the dispatcher can push
-- specifically to staff carrying selected role keys, with semantics
-- that will bypass quiet-hours / on-shift gates once those are built.
--
-- call_surgeon is removed (replaced by include_surgeon_override + the
-- per-surgeon opt-in below).

alter table public.zone_alert_actions
  drop column call_surgeon;

alter table public.zone_alert_actions
  add column override_role_keys text[] not null default '{}'::text[],
  add column include_surgeon_override boolean not null default false;

-- Per-surgeon opt-in. When true, the dispatcher's "include surgeon"
-- option will push to the patient's own surgeon even when that would
-- normally be considered out-of-hours. Default false — surgeons opt in
-- only if they want their phone buzzing after hours for their patients.
alter table public.staff_users
  add column notify_after_hours boolean not null default false;

-- Sensible new defaults under the role-targeted model:
--   • yellow: email + general in-app (no override roles)
--   • orange: email + general in-app + override-message to Nurse + Surgeon
--   • red:    email + general in-app + override-message to Nurse + Surgeon
--             + Manager + include the patient's specific surgeon
update public.zone_alert_actions
  set override_role_keys = '{}', include_surgeon_override = false
  where alert_level = 'yellow';

update public.zone_alert_actions
  set override_role_keys = array['nurse','surgeon'],
      include_surgeon_override = false
  where alert_level = 'orange';

update public.zone_alert_actions
  set override_role_keys = array['nurse','surgeon','manager'],
      include_surgeon_override = true
  where alert_level = 'red';

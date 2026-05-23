-- The clinic doesn't currently employ nurses. Drop "nurse" from the
-- override defaults, and simplify the override targeting:
--   • Yellow: no override.
--   • Orange: override → Manager.
--   • Red:    override → Manager. Surgeon is optional via the per-zone
--             "Include the patient's surgeon" toggle (still on for Red).

update public.zone_alert_actions
  set override_role_keys = '{}'::text[],
      include_surgeon_override = false
  where alert_level = 'yellow';

update public.zone_alert_actions
  set override_role_keys = array['manager'],
      include_surgeon_override = false
  where alert_level = 'orange';

update public.zone_alert_actions
  set override_role_keys = array['manager'],
      include_surgeon_override = true
  where alert_level = 'red';

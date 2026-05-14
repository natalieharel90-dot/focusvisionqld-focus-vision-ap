-- Default routing ruleset (spec section 6.7).
-- Applies to every patient unless a more-specific (procedure × surgeon /
-- surgeon-only / procedure-only) ruleset overrides a particular rule.
--
-- The ruleset id is fixed (d0000001-…) so future migrations and tests can
-- reference it deterministically. Inserts are idempotent via ON CONFLICT.

insert into public.routing_rulesets (id, name, procedure_type, surgeon_id)
values ('d0000001-0000-0000-0000-000000000001', 'Default', null, null)
on conflict do nothing;

insert into public.routing_rules (ruleset_id, item_key, item_value, route)
select 'd0000001-0000-0000-0000-000000000001'::uuid,
       r.item_key, r.item_value, r.route::public.route_action
from (values
  -- Pain (0–5): mild ignored, moderate yellow, marked orange, severe red.
  ('pain', '0', 'off'),
  ('pain', '1', 'off'),
  ('pain', '2', 'yellow'),
  ('pain', '3', 'orange'),
  ('pain', '4', 'red'),
  ('pain', '5', 'red'),

  -- Light sensitivity (0–5): expect some in the first week post-op.
  ('light_sensitivity', '0', 'off'),
  ('light_sensitivity', '1', 'off'),
  ('light_sensitivity', '2', 'off'),
  ('light_sensitivity', '3', 'yellow'),
  ('light_sensitivity', '4', 'orange'),
  ('light_sensitivity', '5', 'orange'),

  -- Vision self-report: worsening is concerning, same/better unremarkable.
  ('vision', 'worse', 'yellow'),
  ('vision', 'same', 'off'),
  ('vision', 'better', 'off'),

  -- Symptom chips: clinically significant ones flagged; common
  -- post-op sensations (watering, grittiness) are off by design.
  -- New symptoms added in Settings default to 'orange' (safer default)
  -- per spec — these explicit rows are deliberate overrides.
  ('chip:flashes_of_light', 'true', 'red'),
  ('chip:shadow_curtain', 'true', 'red'),
  ('chip:sudden_vision_loss', 'true', 'red'),
  ('chip:severe_pain', 'true', 'red'),
  ('chip:eye_pain', 'true', 'orange'),
  ('chip:discharge', 'true', 'orange'),
  ('chip:floaters', 'true', 'yellow'),
  ('chip:halos', 'true', 'yellow'),
  ('chip:itching', 'true', 'yellow'),
  ('chip:watering', 'true', 'off'),
  ('chip:grittiness', 'true', 'off')
) as r(item_key, item_value, route)
on conflict (ruleset_id, item_key, item_value) do nothing;

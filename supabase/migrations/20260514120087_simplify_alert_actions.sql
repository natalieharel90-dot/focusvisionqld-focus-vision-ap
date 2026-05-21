-- Simplify zone_alert_actions to the three actions the clinic actually
-- wants: email hello@focusvision.com.au, in-app alert to staff, and an
-- auto-call to the patient's surgeon (per-surgeon phone resolved from
-- staff_users.phone at dispatch time, so different surgeons get rung
-- on different numbers).
--
-- The removed columns (push_to_oncall, sms_oncall, autocall_oncall,
-- additional_email, oncall_number) are dropped — no dispatcher reads
-- them, and the simpler model maps directly onto the new UI.

alter table public.zone_alert_actions
  drop column push_to_oncall,
  drop column sms_oncall,
  drop column autocall_oncall,
  drop column additional_email,
  drop column oncall_number;

alter table public.zone_alert_actions
  add column call_surgeon boolean not null default false;

-- Sensible defaults under the new model: yellow notifies (no call),
-- orange and red also call the patient's surgeon.
update public.zone_alert_actions
  set email_clinic = true, inapp_to_all = true, call_surgeon = false
  where alert_level = 'yellow';

update public.zone_alert_actions
  set email_clinic = true, inapp_to_all = true, call_surgeon = true
  where alert_level in ('orange', 'red');

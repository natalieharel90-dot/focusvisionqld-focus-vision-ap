-- Make the hidden bonus theme pack a staff-controlled per-patient
-- feature. Eligibility plugs into the existing feature_defaults /
-- patient_feature_flags pattern (same shape as surgeon_spotlight etc.).
--
-- Clinic-wide default is OFF: a patient can only self-unlock the pack
-- via the in-app Easter egg once staff have enabled it for them.

insert into public.feature_defaults (feature_key, enabled, config)
values ('bonus_theme_pack', false, '{}'::jsonb)
on conflict (feature_key) do nothing;

-- Backfill a per-patient flag for every already-activated patient so the
-- snapshot pattern stays consistent. Grandfather anyone who already
-- discovered the pack under the old any-patient rules — onboarding done
-- AND already unlocked — so we don't pull the rug out from under them.
insert into public.patient_feature_flags (patient_id, feature_key, enabled)
select
  t.patient_id,
  'bonus_theme_pack',
  coalesce(
    up.bonus_pack_unlocked and up.onboarding_completed_at is not null,
    false
  )
from public.patient_setup_tasks t
left join public.user_preferences up on up.patient_id = t.patient_id
where t.status = 'activated'
on conflict (patient_id, feature_key) do nothing;

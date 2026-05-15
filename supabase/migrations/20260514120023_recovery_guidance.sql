-- Recovery guidance editor support:
--   1. Make zone_content content fields nullable so a more-specific row
--      can override individual fields and inherit the rest (per-field
--      fallback, not per-row).
--   2. Refresh the Default rows with the prototype's placeholder copy.
--   3. public_zone_content view so the patient app can read guidance
--      (zone_content itself stays staff-only via RLS).

-- ── Nullable content fields ──────────────────────────────────────────────
-- A NULL field means "inherit from the next level up". The Default tier
-- always has every field populated, so the merge always resolves.

alter table public.zone_content
  alter column headline drop not null,
  alter column message drop not null,
  alter column expected_symptoms drop not null,
  alter column expected_symptoms drop default;

-- ── Default copy (placeholder — needs clinical sign-off) ─────────────────

update public.zone_content set
  headline = 'You''re tracking beautifully',
  message = 'Your symptoms today are completely within the range we''d expect. Mild grittiness, slight light sensitivity, and fluctuating vision are all normal. Keep going — you''re doing all the right things.',
  expected_symptoms = array[
    'Mild grittiness or "sand in the eye" feeling',
    'Slight light sensitivity in bright environments',
    'Vision that fluctuates through the day',
    'Watery eyes, especially in wind or cold',
    'Slight halos around lights at night',
    'Mild dryness — keep using lubricating drops'
  ],
  today_tip = 'Keep using artificial tears every 1–2 hours, even if your eyes feel fine. Hydration is the single biggest comfort factor in week one. Avoid rubbing your eyes — if they itch, use a cool compress instead.',
  instructions = null,
  warning = null
where zone = 'green' and procedure_type is null and surgeon_id is null;

update public.zone_content set
  headline = 'On track — let''s take it easy',
  message = 'Your symptoms today are still within the range we''d expect, but at the higher end. This isn''t unusual — let''s give your eyes a chance to settle.',
  expected_symptoms = array[
    'Mild to moderate grittiness or scratching',
    'Light sensitivity in bright environments',
    'Fluctuating vision, especially when tired',
    'Moderate dryness — use drops more often',
    'Halos around lights at night',
    'Mild discomfort or tiredness'
  ],
  today_tip = null,
  instructions = 'Try to rest your eyes, avoid screens for a few hours, drink plenty of water, and apply lubricating drops more frequently (every 30–60 minutes). Wear sunglasses outdoors. Skip exercise today.',
  warning = 'If symptoms get worse through the day — increasing pain, dropping vision, more redness, or any discharge — please contact the clinic. Don''t wait until tomorrow''s check-in.'
where zone = 'yellow' and procedure_type is null and surgeon_id is null;

update public.zone_content set
  headline = 'Let''s have a chat today',
  message = 'What you''re describing can happen during recovery and is often nothing to worry about — but we''d like to talk with you to make sure everything is on track. Please contact the clinic today so one of our optometrists can check in with you.',
  expected_symptoms = array[]::text[],
  today_tip = null,
  instructions = null,
  warning = 'If symptoms are severe — sudden vision loss, severe pain, or worsening rapidly — go to your nearest emergency department.'
where zone = 'orange' and procedure_type is null and surgeon_id is null;

-- ── public_zone_content view ─────────────────────────────────────────────
-- zone_content RLS is staff-only (migration 9). The patient app needs to
-- read the looked-up guidance. This view runs with the definer's rights
-- (security_invoker not set), so SELECT on the view bypasses the table
-- RLS. Guidance is clinic-authored content shared by all patients — not
-- patient-specific data — so broad read access is correct. Internal
-- columns (updated_by, timestamps) are deliberately not exposed.

create view public.public_zone_content as
  select id, zone, procedure_type, surgeon_id, headline, message,
         expected_symptoms, today_tip, instructions, warning
  from public.zone_content;

grant select on public.public_zone_content to anon, authenticated;

-- Seed data for development. No real patient information.
-- Per CLAUDE.md: names are explicitly "Test Patient One"–"Five" so they
-- cannot be mistaken for real records in logs or screenshots.
--
-- Apply against remote:
--   psql "$SUPABASE_DB_URL" -f supabase/seed.sql
-- Or paste contents into the Supabase dashboard SQL Editor.
--
-- Today (relative to recovery days below): 2026-05-14.

-- ─── Staff (auth.users + staff_users) ──────────────────────────────────────

-- Token columns must be empty strings (not NULL) for newer Supabase Auth.
-- Omitting them yields "Database error querying schema" on sign-in.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current, email_change,
  phone_change, phone_change_token, reauthentication_token
) values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'maria.chen@focusvision.dev',
   crypt('seed-only-do-not-use', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"Dr Maria Chen"}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'jonathan.nguyen@focusvision.dev',
   crypt('seed-only-do-not-use', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"Dr Jonathan Nguyen"}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into public.staff_users (id, email, name, role) values
  ('11111111-1111-1111-1111-111111111111',
   'maria.chen@focusvision.dev', 'Dr Maria Chen', 'surgeon'),
  ('22222222-2222-2222-2222-222222222222',
   'jonathan.nguyen@focusvision.dev', 'Dr Jonathan Nguyen', 'surgeon')
on conflict (id) do nothing;

-- ─── Patients (auth.users + patients) ──────────────────────────────────────

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current, email_change,
  phone_change, phone_change_token, reauthentication_token
) values
  ('a0000001-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'patient.one@example.dev',
   crypt('seed-only-do-not-use', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', ''),
  ('a0000002-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'patient.two@example.dev',
   crypt('seed-only-do-not-use', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', ''),
  ('a0000003-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'patient.three@example.dev',
   crypt('seed-only-do-not-use', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', ''),
  ('a0000004-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'patient.four@example.dev',
   crypt('seed-only-do-not-use', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', ''),
  ('a0000005-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'patient.five@example.dev',
   crypt('seed-only-do-not-use', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb, now(), now(),
   '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

-- Newer Supabase Auth (GoTrue) requires an auth.identities row per
-- (provider, user). Without it sign-in fails with "Database error
-- querying schema" — the application code never sees these rows directly
-- but GoTrue's user lookup joins through them.
insert into auth.identities (
  user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  u.id, u.id::text,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email', now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'a0000001-0000-0000-0000-000000000001',
  'a0000002-0000-0000-0000-000000000002',
  'a0000003-0000-0000-0000-000000000003',
  'a0000004-0000-0000-0000-000000000004',
  'a0000005-0000-0000-0000-000000000005'
)
on conflict (provider_id, provider) do nothing;

insert into public.patients (
  id, email, phone, phone_verified, name, date_of_birth,
  emergency_contact, allergies
) values
  ('a0000001-0000-0000-0000-000000000001',
   'patient.one@example.dev', '+61400000001', true,
   'Test Patient One', '1984-03-12',
   '{"name":"Mark One","relationship":"Spouse","phone":"+61400900001"}'::jsonb,
   '{}'),
  ('a0000002-0000-0000-0000-000000000002',
   'patient.two@example.dev', '+61400000002', true,
   'Test Patient Two', '1971-09-04',
   '{"name":"Anna Two","relationship":"Sister","phone":"+61400900002"}'::jsonb,
   '{"sulfonamides"}'),
  ('a0000003-0000-0000-0000-000000000003',
   'patient.three@example.dev', '+61400000003', true,
   'Test Patient Three', '1996-12-29',
   '{"name":"Lee Three","relationship":"Parent","phone":"+61400900003"}'::jsonb,
   '{}'),
  ('a0000004-0000-0000-0000-000000000004',
   'patient.four@example.dev', '+61400000004', true,
   'Test Patient Four', '1958-06-18',
   '{"name":"Priya Four","relationship":"Daughter","phone":"+61400900004"}'::jsonb,
   '{"penicillin"}'),
  ('a0000005-0000-0000-0000-000000000005',
   'patient.five@example.dev', '+61400000005', true,
   'Test Patient Five', '1989-01-22',
   '{"name":"Sam Five","relationship":"Partner","phone":"+61400900005"}'::jsonb,
   '{}')
on conflict (id) do nothing;

-- ─── Procedures (one per patient — different types, surgeons, recovery days)─

insert into public.procedures (
  id, patient_id, procedure_type, eye, surgeon_id,
  surgery_date, status
) values
  ('b0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001', 'lasik', 'both',
   '11111111-1111-1111-1111-111111111111',  -- Dr Chen
   '2026-05-10', 'active'),                  -- Day 4
  ('b0000002-0000-0000-0000-000000000002',
   'a0000002-0000-0000-0000-000000000002', 'prk', 'both',
   '22222222-2222-2222-2222-222222222222',  -- Dr Nguyen
   '2026-05-07', 'active'),                  -- Day 7
  ('b0000003-0000-0000-0000-000000000003',
   'a0000003-0000-0000-0000-000000000003', 'smile', 'both',
   '11111111-1111-1111-1111-111111111111',  -- Dr Chen
   '2026-05-12', 'active'),                  -- Day 2
  ('b0000004-0000-0000-0000-000000000004',
   'a0000004-0000-0000-0000-000000000004', 'cataract', 'right',
   '22222222-2222-2222-2222-222222222222',  -- Dr Nguyen
   '2026-04-30', 'active'),                  -- Day 14
  ('b0000005-0000-0000-0000-000000000005',
   'a0000005-0000-0000-0000-000000000005', 'icl', 'both',
   '11111111-1111-1111-1111-111111111111',  -- Dr Chen
   '2026-05-14', 'active')                   -- Day 0
on conflict (id) do nothing;

-- ─── Medications (typical post-op drops + tears) ──────────────────────────

insert into public.medications (
  id, patient_id, name, dose, route, frequency,
  scheduled_times, start_date, end_date, taper_notes
) values
  -- Patient One (LASIK, Day 4)
  ('c0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001',
   'Pred Forte 1%', '1 drop', 'topical eye', '4x daily',
   '{"08:00","12:00","16:00","20:00"}', '2026-05-10', '2026-05-24',
   'Taper to 3x daily after first week, 2x daily after second.'),
  ('c0000002-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001',
   'Chlorsig 0.5%', '1 drop', 'topical eye', '4x daily',
   '{"08:00","12:00","16:00","20:00"}', '2026-05-10', '2026-05-17', null),

  -- Patient Two (PRK, Day 7)
  ('c0000003-0000-0000-0000-000000000002',
   'a0000002-0000-0000-0000-000000000002',
   'Pred Forte 1%', '1 drop', 'topical eye', '4x daily',
   '{"08:00","12:00","16:00","20:00"}', '2026-05-07', '2026-06-04',
   'PRK requires longer taper (4 weeks).'),
  ('c0000004-0000-0000-0000-000000000002',
   'a0000002-0000-0000-0000-000000000002',
   'Artificial tears', '1 drop', 'topical eye', '6x daily',
   '{"08:00","11:00","13:00","16:00","19:00","21:00"}',
   '2026-05-07', null, null),

  -- Patient Three (SMILE, Day 2)
  ('c0000005-0000-0000-0000-000000000003',
   'a0000003-0000-0000-0000-000000000003',
   'Pred Forte 1%', '1 drop', 'topical eye', '4x daily',
   '{"08:00","12:00","16:00","20:00"}', '2026-05-12', '2026-05-26', null),

  -- Patient Four (Cataract right, Day 14)
  ('c0000006-0000-0000-0000-000000000004',
   'a0000004-0000-0000-0000-000000000004',
   'Maxidex 0.1%', '1 drop', 'topical right eye', '4x daily',
   '{"08:00","12:00","16:00","20:00"}', '2026-04-30', '2026-05-21', null),

  -- Patient Five (ICL, Day 0 — just had surgery)
  ('c0000007-0000-0000-0000-000000000005',
   'a0000005-0000-0000-0000-000000000005',
   'Pred Forte 1%', '1 drop', 'topical eye', '4x daily',
   '{"08:00","12:00","16:00","20:00"}', '2026-05-14', '2026-05-28', null),
  ('c0000008-0000-0000-0000-000000000005',
   'a0000005-0000-0000-0000-000000000005',
   'Chlorsig 0.5%', '1 drop', 'topical eye', '4x daily',
   '{"08:00","12:00","16:00","20:00"}', '2026-05-14', '2026-05-21', null)
on conflict (id) do nothing;

-- ─── Appointments (1-week follow-ups: some booked, some to_book) ──────────

insert into public.appointments (
  patient_id, appointment_type, scheduled_at,
  clinician_id, location, status
) values
  ('a0000001-0000-0000-0000-000000000001', '1-week',
   '2026-05-17 10:30:00+10', '11111111-1111-1111-1111-111111111111',
   'in_clinic', 'confirmed'),
  ('a0000002-0000-0000-0000-000000000002', '1-week',
   '2026-05-14 14:00:00+10', '22222222-2222-2222-2222-222222222222',
   'in_clinic', 'confirmed'),
  ('a0000003-0000-0000-0000-000000000003', '1-week',
   null, null, null, 'to_book'),
  ('a0000004-0000-0000-0000-000000000004', '1-month',
   '2026-05-28 09:00:00+10', '22222222-2222-2222-2222-222222222222',
   'in_clinic', 'confirmed'),
  ('a0000005-0000-0000-0000-000000000005', '1-week',
   null, null, null, 'to_book');

-- ─── Daily check-ins (one per day completed so far per patient) ───────────
-- patient_zone and staff_alert_level values below align with what
-- lib/zones.ts produces against the default ruleset (migration 11).
-- In production these are computed by the engine on submit; this seed
-- writes them directly so the dashboard has data without re-running the
-- routing engine.

insert into public.check_ins (
  patient_id, recovery_day, vision, pain, light_sensitivity,
  unusual_symptoms, patient_zone, staff_alert_level
) values
  -- Patient One: days 1–4 (LASIK)
  ('a0000001-0000-0000-0000-000000000001', 1, 'better', 1, 2, '{}', 'green', 'none'),
  ('a0000001-0000-0000-0000-000000000001', 2, 'better', 0, 3, '{"halos"}', 'yellow', 'yellow'),
  ('a0000001-0000-0000-0000-000000000001', 3, 'better', 0, 1, '{}', 'green', 'none'),
  ('a0000001-0000-0000-0000-000000000001', 4, 'better', 0, 1, '{}', 'green', 'none'),

  -- Patient Two: days 1–7 (PRK, slower recovery — some yellow)
  ('a0000002-0000-0000-0000-000000000002', 1, 'same', 3, 4, '{"watering","grittiness"}', 'orange', 'orange'),
  ('a0000002-0000-0000-0000-000000000002', 2, 'same', 2, 3, '{"grittiness"}', 'yellow', 'yellow'),
  ('a0000002-0000-0000-0000-000000000002', 3, 'same', 2, 2, '{}', 'yellow', 'yellow'),
  ('a0000002-0000-0000-0000-000000000002', 4, 'better', 1, 2, '{}', 'green', 'none'),
  ('a0000002-0000-0000-0000-000000000002', 5, 'better', 1, 1, '{}', 'green', 'none'),
  ('a0000002-0000-0000-0000-000000000002', 6, 'better', 0, 1, '{}', 'green', 'none'),
  ('a0000002-0000-0000-0000-000000000002', 7, 'better', 0, 1, '{}', 'green', 'none'),

  -- Patient Three: days 1–2 (SMILE)
  ('a0000003-0000-0000-0000-000000000003', 1, 'better', 1, 2, '{}', 'green', 'none'),
  ('a0000003-0000-0000-0000-000000000003', 2, 'better', 1, 1, '{}', 'green', 'none'),

  -- Patient Four: pick a few of the 14 days (Cataract right eye)
  ('a0000004-0000-0000-0000-000000000004', 1, 'better', 1, 2, '{}', 'green', 'none'),
  ('a0000004-0000-0000-0000-000000000004', 7, 'better', 0, 1, '{}', 'green', 'none'),
  ('a0000004-0000-0000-0000-000000000004', 14, 'better', 0, 0, '{}', 'green', 'none');

-- Patient Five (Day 0) has no check-ins yet — daily check-ins start Day 1.

-- ─── Message threads (one open thread per patient) ────────────────────────

insert into public.message_threads (patient_id, status) values
  ('a0000001-0000-0000-0000-000000000001', 'open'),
  ('a0000002-0000-0000-0000-000000000002', 'open'),
  ('a0000003-0000-0000-0000-000000000003', 'open'),
  ('a0000004-0000-0000-0000-000000000004', 'open'),
  ('a0000005-0000-0000-0000-000000000005', 'open')
on conflict (patient_id) do nothing;

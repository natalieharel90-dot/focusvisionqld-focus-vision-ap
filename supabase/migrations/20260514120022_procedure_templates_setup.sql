-- Procedures library — soft-delete on templates, source_template_id on
-- the rows defaults get applied to (so analytics can compare patient
-- state to template), SECURITY DEFINER for patient bootstrap, and seed
-- starter templates.

-- ── source_template_id on medications + appointments ─────────────────────
-- procedures already has it from migration 3. medications + appointments
-- need it so we can trace per-patient drift back to the originating
-- template (intentionally NEVER update once set — historical link).

alter table public.medications
  add column source_template_id uuid references public.procedure_templates(id) on delete set null;

alter table public.appointments
  add column source_template_id uuid references public.procedure_templates(id) on delete set null;

-- ── soft-delete on procedure_templates ───────────────────────────────────
-- Per spec: templates can be archived, never hard-deleted, so historical
-- patients still trace back to the template that set them up.

alter table public.procedure_templates
  add column archived_at timestamptz,
  add column archived_by uuid references public.staff_users(id);

create index procedure_templates_active_idx
  on public.procedure_templates (surgeon_id, procedure_type)
  where archived_at is null;

-- ── create_patient_auth_user(email, password) ───────────────────────────
-- Bootstrap a patient's auth.users + auth.identities rows from the staff
-- create-patient flow. Staff can't INSERT into auth schema directly;
-- this SECURITY DEFINER function does it on their behalf with
-- gen_random_uuid() so the new id is the function's caller's choice
-- only via the returned value.

create or replace function public.create_patient_auth_user(
  p_email text,
  p_password text
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  if p_email is null or btrim(p_email) = '' then
    raise exception 'email_required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'password_too_short';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current, email_change,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    btrim(p_email), crypt(p_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id, v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', btrim(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  return v_user_id;
end;
$$;

revoke all on function public.create_patient_auth_user(text, text) from public;
grant execute on function public.create_patient_auth_user(text, text) to authenticated;

-- ── Seed starter templates ───────────────────────────────────────────────
-- Three starter templates so the Procedures library isn't empty on
-- first load. UUIDs are deterministic for traceability + reseed.

insert into public.procedure_templates (
  id, surgeon_id, procedure_type,
  default_medications, default_appointments,
  default_preop_content_ids, default_postop_content_ids
) values
  -- Dr Chen × LASIK
  ('e0000001-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'lasik',
   '[
     {"name":"Pred Forte 1%","dose":"1 drop","route":"topical eye","frequency":"4x daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":14,"taper_notes":"Taper to 3x daily after first week, then 2x daily"},
     {"name":"Chlorsig 0.5%","dose":"1 drop","route":"topical eye","frequency":"4x daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"taper_notes":null}
   ]'::jsonb,
   '[
     {"appointment_type":"1-week","days_after_surgery":7,"location":"in_clinic","notes":null},
     {"appointment_type":"1-month","days_after_surgery":30,"location":"in_clinic","notes":null}
   ]'::jsonb,
   '{}', '{}'),

  -- Dr Chen × Cataract
  ('e0000002-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   'cataract',
   '[
     {"name":"Maxidex 0.1%","dose":"1 drop","route":"topical eye","frequency":"4x daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":21,"taper_notes":null}
   ]'::jsonb,
   '[
     {"appointment_type":"1-week","days_after_surgery":7,"location":"in_clinic","notes":null},
     {"appointment_type":"1-month","days_after_surgery":30,"location":"in_clinic","notes":null}
   ]'::jsonb,
   '{}', '{}'),

  -- Dr Nguyen × PRK
  ('e0000003-0000-0000-0000-000000000003',
   '22222222-2222-2222-2222-222222222222',
   'prk',
   '[
     {"name":"Pred Forte 1%","dose":"1 drop","route":"topical eye","frequency":"4x daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"taper_notes":"PRK requires longer steroid course (4 weeks). Taper from week 3."},
     {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"6x daily","scheduled_times":["08:00","11:00","13:00","16:00","19:00","21:00"],"duration_days":90,"taper_notes":null}
   ]'::jsonb,
   '[
     {"appointment_type":"1-week","days_after_surgery":7,"location":"in_clinic","notes":null},
     {"appointment_type":"1-month","days_after_surgery":30,"location":"in_clinic","notes":null},
     {"appointment_type":"3-month","days_after_surgery":90,"location":"in_clinic","notes":null}
   ]'::jsonb,
   '{}', '{}')
on conflict (surgeon_id, procedure_type) do nothing;

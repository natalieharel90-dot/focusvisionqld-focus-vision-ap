-- Patient Documents + Contact clinic screens (spec §5.6, §5.8).
--   - documents Storage bucket + a title column
--   - contact_options (configurable Contact-screen rows)
--   - clinic_profile (single-row clinic details + opening hours)
--   - record_patient_audit_event() for patient-actor audit with entity info

-- ── documents: display title + Storage bucket ────────────────────────────
alter table public.documents
  add column title text;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Path convention: <patient_uuid>/<filename>. Staff upload; the patient
-- reads only their own; signed URLs are issued on view.
create policy "patient_read_own_documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff_read_all_documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_staff());

create policy "staff_upload_documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_staff());

-- ── contact_options ──────────────────────────────────────────────────────
-- Configurable rows for the patient Contact clinic screen, editable in
-- dashboard Settings. is_required rows (Call the clinic) always render.
create table public.contact_options (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  subtitle text,
  icon text not null default 'phone',
  action_type text not null
    check (action_type in ('call', 'message', 'book', 'map', 'url', 'custom')),
  action_value text,
  order_index integer not null default 0,
  enabled boolean not null default true,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.contact_options
for each row execute function public.set_updated_at();

create index contact_options_order_idx on public.contact_options (order_index);

alter table public.contact_options enable row level security;

-- Clinic-wide config (no PII) — any signed-in user reads; staff edit.
create policy contact_options_select on public.contact_options
  for select using (auth.uid() is not null);
create policy contact_options_staff_write on public.contact_options
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.contact_options
  (label, subtitle, icon, action_type, action_value, order_index, enabled, is_required)
values
  ('Call the clinic', '(07) 5555 0123 · in hours', 'phone',
   'call', '(07) 5555 0123', 1, true, true),
  ('Message the clinic', 'Sent to the Focus Vision team · ~2 hour reply',
   'message', 'message', '/messages', 2, true, false),
  ('Book or change your follow-up', 'Online booking', 'calendar',
   'book', 'https://focusvision.example/book', 3, true, false),
  ('Directions to clinic', '123 Vision Way, Brisbane QLD', 'map',
   'map', 'https://maps.google.com/?q=123+Vision+Way+Brisbane+QLD', 4, true, false),
  ('Out-of-hours', 'Leave a voicemail and we''ll call you back', 'clock',
   'custom', null, 5, true, false);

-- ── clinic_profile ───────────────────────────────────────────────────────
-- Single-row clinic details. opening_hours is per-weekday [open, close]
-- (24h "HH:MM"); null = closed that day.
create table public.clinic_profile (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text not null,
  after_hours_phone text not null,
  after_hours_message text not null,
  opening_hours jsonb not null,
  timezone text not null default 'Australia/Brisbane',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.clinic_profile
for each row execute function public.set_updated_at();

alter table public.clinic_profile enable row level security;

create policy clinic_profile_select on public.clinic_profile
  for select using (auth.uid() is not null);
create policy clinic_profile_staff_write on public.clinic_profile
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.clinic_profile
  (name, address, phone, after_hours_phone, after_hours_message,
   opening_hours, timezone)
values (
  'Focus Vision',
  '123 Vision Way, Brisbane QLD 4000',
  '(07) 5555 0123',
  '0400 555 999',
  'If you have sudden vision loss, severe pain, or a chemical splash to the eye, go to your nearest emergency department.',
  '{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","17:00"],"sat":["09:00","13:00"],"sun":null}'::jsonb,
  'Australia/Brisbane'
);

-- ── record_patient_audit_event ───────────────────────────────────────────
-- Like record_patient_audit, but records a specific entity_type/entity_id
-- (record_patient_audit hardcodes 'user_preferences'). Used for patient
-- document views and Contact-screen tap analytics.
create or replace function public.record_patient_audit_event(
  p_event_type text,
  p_entity_type text,
  p_new_value jsonb,
  p_entity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.patients where id = v_uid) then
    raise exception 'not_a_patient';
  end if;

  insert into public.audit_events (
    actor_staff_id, actor_role, event_type,
    patient_id, entity_type, entity_id, new_value
  ) values (
    null, 'patient', p_event_type,
    v_uid, p_entity_type, p_entity_id, p_new_value
  );
end;
$$;

revoke all on function
  public.record_patient_audit_event(text, text, jsonb, uuid) from public;
grant execute on function
  public.record_patient_audit_event(text, text, jsonb, uuid) to authenticated;

-- Messaging support:
--   1. message_templates table (clinic-configured quick replies)
--   2. message-attachments storage bucket + RLS
--   3. Patient INSERT policy on message_threads so the patient app can
--      lazily create the thread on first /messages visit
--   4. Add public.messages to the realtime publication

-- ── message_templates ──────────────────────────────────────────────────────

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  body text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.message_templates
for each row execute function public.set_updated_at();

alter table public.message_templates enable row level security;

create policy message_templates_staff_select on public.message_templates
  for select using (public.is_staff());
create policy message_templates_staff_write on public.message_templates
  for all using (public.is_staff()) with check (public.is_staff());

-- A small starter pack. Staff edit/add via SQL until the templates admin
-- UI lands (separate session).
insert into public.message_templates (label, body, category) values
  ('Greeting',
   'Hi — thanks for getting in touch. I''m looking at this now and will get back to you shortly.',
   'greeting'),
  ('Drops reminder',
   'A quick reminder to continue your prescribed eye drops on schedule. Let us know if you''re running low or if you have any side effects.',
   'reminder'),
  ('Appointment booking',
   'I''d like to bring you in for a check. Could you reply with a few times that work this week?',
   'scheduling'),
  ('Normal symptoms reassurance',
   'What you''re describing is common in this stage of recovery and isn''t a cause for concern. Keep an eye on it and message again if it changes.',
   'reassurance'),
  ('Escalate to clinician',
   'I''m going to flag this with the surgical team. Someone will be in touch directly today.',
   'escalation');

-- ── Patient INSERT policy on message_threads ───────────────────────────────
-- The patient app lazily creates a thread on first visit to /messages if
-- one doesn't exist (seed already creates them for known patients, but
-- this policy keeps future patient onboarding flexible).

create policy message_threads_patient_insert on public.message_threads
  for insert with check (patient_id = auth.uid());

-- ── message-attachments storage bucket ─────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

-- Path convention: <thread_id>/<random>.<ext>. Anyone with access to the
-- thread (the patient on it, or any staff member) can read; the patient
-- can upload to their own thread; staff can upload to any thread.

create policy "patient_upload_own_thread_attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.message_threads t
      where t.id::text = (storage.foldername(name))[1]
        and t.patient_id = auth.uid()
    )
  );

create policy "patient_read_own_thread_attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.message_threads t
      where t.id::text = (storage.foldername(name))[1]
        and t.patient_id = auth.uid()
    )
  );

create policy "staff_message_attachments_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'message-attachments' and public.is_staff())
  with check (bucket_id = 'message-attachments' and public.is_staff());

-- ── Realtime publication ───────────────────────────────────────────────────
-- Add messages to the default supabase_realtime publication so clients
-- can subscribe to INSERTs (for live delivery).

alter publication supabase_realtime add table public.messages;

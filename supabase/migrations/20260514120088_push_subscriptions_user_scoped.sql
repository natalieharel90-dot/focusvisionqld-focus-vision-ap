-- Make push_subscriptions hold both patient and staff devices so the
-- alert dispatcher can ring the patient's surgeon (and any other on-duty
-- staff) the same way it rings patients. patient_id was the natural key
-- when only patients subscribed; rename it to user_id and drop the FK
-- to patients so staff_users ids can live here too. Existing rows keep
-- their UUIDs — they're already auth.users ids.

alter table public.push_subscriptions
  drop constraint push_subscriptions_patient_id_fkey;
alter table public.push_subscriptions
  rename column patient_id to user_id;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop index if exists push_subscriptions_patient_idx;
create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- ── alert_dispatches: an audit log for the alert dispatcher ─────────
-- One row per alert fired. Lets us see what was sent, to whom, and
-- whether any leg failed (e.g. Resend rejected the email). Append-only
-- by convention; no triggers, just don't delete from it.

create table public.alert_dispatches (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid references public.check_ins(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  alert_level public.staff_alert_level not null,
  email_sent boolean not null default false,
  inapp_pushed integer not null default 0,
  surgeon_pushed boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

create index alert_dispatches_check_in_idx
  on public.alert_dispatches (check_in_id);
create index alert_dispatches_patient_idx
  on public.alert_dispatches (patient_id);

alter table public.alert_dispatches enable row level security;
create policy alert_dispatches_staff_select on public.alert_dispatches
  for select using (public.is_staff());

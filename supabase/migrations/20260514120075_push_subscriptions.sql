-- Web Push subscriptions. One row per patient device that has opted in to
-- notifications. The push sender runs server-side with the service role,
-- so no staff-facing read policy is needed here.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_patient_idx
  on public.push_subscriptions (patient_id);

alter table public.push_subscriptions enable row level security;

-- A patient fully manages the subscriptions for their own devices.
create policy push_subscriptions_own on public.push_subscriptions
  for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

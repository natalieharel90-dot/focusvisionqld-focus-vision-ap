-- Patient mobile-number verification. After signing in, a patient with an
-- unverified phone confirms it via a 6-digit SMS code. patients.phone is
-- only written once a code is confirmed (patients.phone_verified flips
-- true), per the "don't store unverified phone numbers" rule.
create table public.patient_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index patient_phone_verifications_patient_idx
  on public.patient_phone_verifications (patient_id, created_at desc);

alter table public.patient_phone_verifications enable row level security;

-- A patient fully manages their own verification rows.
create policy patient_phone_verifications_self
  on public.patient_phone_verifications
  for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

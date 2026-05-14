-- Patients + medications (with soft-delete) + medication_doses.

-- patients.id is 1:1 with auth.users.id. Patient onboarding writes both rows
-- atomically. phone is only persisted after SMS MFA verification per
-- CLAUDE.md; phone_verified records that this happened.
create table public.patients (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  phone text,
  phone_verified boolean not null default false,
  name text not null,
  date_of_birth date,
  medicare_number text,
  health_fund jsonb,
  emergency_contact jsonb,
  allergies text[] not null default '{}',
  paired_clinic_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

-- Now that patients exists, add the FK on procedures.patient_id.
alter table public.procedures
  add constraint procedures_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete cascade;

-- Soft-delete: stopping a medication sets stopped_at + stopped_by_staff_id +
-- stop_reason. The row is preserved in the clinical record but excluded
-- from active reminders and the patient app medication list.
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null,
  dose text not null,
  route text not null,
  frequency text not null,
  scheduled_times text[] not null default '{}',
  start_date date not null,
  end_date date,
  taper_notes text,
  stopped_at timestamptz,
  stopped_by_staff_id uuid references public.staff_users(id),
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Either fully stopped (all three soft-delete columns set) or fully active.
  constraint medications_stopped_columns_together check (
    (stopped_at is null and stopped_by_staff_id is null and stop_reason is null)
    or (stopped_at is not null and stopped_by_staff_id is not null and stop_reason is not null)
  )
);

create trigger set_updated_at
before update on public.medications
for each row execute function public.set_updated_at();

create index medications_patient_id_idx on public.medications (patient_id);
create index medications_active_idx on public.medications (patient_id) where stopped_at is null;

-- One row per scheduled dose. snooze_count = how many times the patient
-- deferred the reminder before completion (visible to staff).
create table public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  scheduled_at timestamptz not null,
  taken_at timestamptz,
  snooze_count integer not null default 0,
  patient_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.medication_doses
for each row execute function public.set_updated_at();

create index medication_doses_medication_id_idx on public.medication_doses (medication_id);
create index medication_doses_scheduled_at_idx on public.medication_doses (scheduled_at);

-- Daily check-ins + appointments.

-- One per (patient, recovery_day). patient_zone is shown to the patient on
-- the result screen; staff_alert_level is the (possibly escalated) signal
-- to the care team. The two are decoupled — a Red staff alert collapses to
-- Orange in patient_zone (calming) per spec section 6.7.
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  recovery_day integer not null,
  vision public.vision_assessment not null,
  pain smallint not null,
  light_sensitivity smallint not null,
  unusual_symptoms text[] not null default '{}',
  other_description text,
  patient_zone public.patient_zone not null,
  staff_alert_level public.staff_alert_level not null,
  reviewed_by uuid references public.staff_users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_ins_pain_range check (pain between 0 and 5),
  constraint check_ins_light_range check (light_sensitivity between 0 and 5),
  constraint check_ins_one_per_day unique (patient_id, recovery_day)
);

create trigger set_updated_at
before update on public.check_ins
for each row execute function public.set_updated_at();

create index check_ins_patient_id_idx on public.check_ins (patient_id);
create index check_ins_staff_alert_idx on public.check_ins (staff_alert_level)
  where staff_alert_level <> 'none';

-- Appointment types per spec (1-week, 1-month, 3-month, 6-month, 12-month,
-- custom) live in TEXT + CHECK so the set can extend without migration.
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_type text not null,
  scheduled_at timestamptz,
  clinician_id uuid references public.staff_users(id),
  location public.appointment_location,
  status public.appointment_status not null default 'to_book',
  notes text,
  calendar_exported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- to_book appointments may have no scheduled_at; all other statuses must.
  constraint appointments_scheduled_when_not_to_book check (
    status = 'to_book' or scheduled_at is not null
  )
);

create trigger set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_status_idx on public.appointments (status);

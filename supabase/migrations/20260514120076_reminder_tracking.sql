-- Phase 2 reminders: track which reminders have been sent so a patient
-- never receives the same one twice.

-- Per-dose flag: set once a medication reminder has been pushed.
alter table public.medication_doses
  add column reminder_sent_at timestamptz;

-- Daily reminders (check-in, nudge): one row per patient, per kind, per
-- day. The unique constraint makes "already reminded today?" a lookup.
create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null,
  sent_on date not null,
  created_at timestamptz not null default now(),
  unique (patient_id, kind, sent_on)
);

-- Only the server-side reminder job (service role) touches this table.
-- RLS on with no policies keeps it inaccessible to patient/staff clients.
alter table public.reminder_log enable row level security;

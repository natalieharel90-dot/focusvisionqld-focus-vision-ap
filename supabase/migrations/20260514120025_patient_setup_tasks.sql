-- New-patient onboarding queue. One patient_setup_tasks row per patient,
-- created when the patient is set up. `status` is derived from the
-- checklist (recomputed by the app on every checklist change) and stored
-- for fast kanban grouping. activated_at / activated_by are stamped on
-- the transition to 'activated'.

create table public.patient_setup_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique
    references public.patients(id) on delete cascade,
  status text not null default 'mfa_pending'
    check (status in ('mfa_pending', 'awaiting_setup', 'partial', 'activated')),
  -- JSON object keyed by checklist item key; each value is
  -- { done: bool, done_at: timestamptz|null, done_by: uuid|null }.
  checklist jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  activated_by_staff_id uuid references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.patient_setup_tasks
for each row execute function public.set_updated_at();

create index patient_setup_tasks_status_idx
  on public.patient_setup_tasks (status);
create index patient_setup_tasks_activated_idx
  on public.patient_setup_tasks (activated_at desc)
  where activated_at is not null;

-- RLS: staff-only. Patients have no visibility into their setup task.
alter table public.patient_setup_tasks enable row level security;

create policy patient_setup_tasks_staff_all on public.patient_setup_tasks
  for all using (public.is_staff()) with check (public.is_staff());

-- ── Seed setup tasks for the 5 existing seed patients ────────────────────
-- A spread across all four columns, plus one activated >7 days ago (to
-- exercise the kanban disappearance rule) and one activated recently.
-- done_by is Dr Chen's staff id.

insert into public.patient_setup_tasks (
  patient_id, status, checklist, activated_at, activated_by_staff_id, created_at
) values
  -- Patient One: fully activated 10 days ago — hidden from the kanban.
  ('a0000001-0000-0000-0000-000000000001', 'activated',
   '{"mfa_verified":{"done":true,"done_at":"2026-05-03T09:00:00Z","done_by":"11111111-1111-1111-1111-111111111111"},
     "template_applied":{"done":true,"done_at":"2026-05-03T09:05:00Z","done_by":"11111111-1111-1111-1111-111111111111"},
     "welcome_sent":{"done":true,"done_at":"2026-05-04T09:00:00Z","done_by":"11111111-1111-1111-1111-111111111111"},
     "first_appointment_booked":{"done":true,"done_at":"2026-05-04T10:00:00Z","done_by":"11111111-1111-1111-1111-111111111111"},
     "preop_content_assigned":{"done":true,"done_at":"2026-05-05T10:00:00Z","done_by":"11111111-1111-1111-1111-111111111111"}}'::jsonb,
   '2026-05-05T10:00:00Z', '11111111-1111-1111-1111-111111111111',
   '2026-05-03T09:00:00Z'),

  -- Patient Two: activated 2 days ago — still visible in the kanban.
  ('a0000002-0000-0000-0000-000000000002', 'activated',
   '{"mfa_verified":{"done":true,"done_at":"2026-05-11T09:00:00Z","done_by":"22222222-2222-2222-2222-222222222222"},
     "template_applied":{"done":true,"done_at":"2026-05-11T09:05:00Z","done_by":"22222222-2222-2222-2222-222222222222"},
     "welcome_sent":{"done":true,"done_at":"2026-05-12T09:00:00Z","done_by":"22222222-2222-2222-2222-222222222222"},
     "first_appointment_booked":{"done":true,"done_at":"2026-05-12T10:00:00Z","done_by":"22222222-2222-2222-2222-222222222222"},
     "preop_content_assigned":{"done":true,"done_at":"2026-05-13T10:00:00Z","done_by":"22222222-2222-2222-2222-222222222222"}}'::jsonb,
   '2026-05-13T10:00:00Z', '22222222-2222-2222-2222-222222222222',
   '2026-05-11T09:00:00Z'),

  -- Patient Three: partial — MFA + template + welcome done.
  ('a0000003-0000-0000-0000-000000000003', 'partial',
   '{"mfa_verified":{"done":true,"done_at":"2026-05-13T09:00:00Z","done_by":"11111111-1111-1111-1111-111111111111"},
     "template_applied":{"done":true,"done_at":"2026-05-13T09:05:00Z","done_by":"11111111-1111-1111-1111-111111111111"},
     "welcome_sent":{"done":true,"done_at":"2026-05-14T09:00:00Z","done_by":"11111111-1111-1111-1111-111111111111"},
     "first_appointment_booked":{"done":false,"done_at":null,"done_by":null},
     "preop_content_assigned":{"done":false,"done_at":null,"done_by":null}}'::jsonb,
   null, null, '2026-05-13T09:00:00Z'),

  -- Patient Four: awaiting setup — MFA verified, nothing else.
  ('a0000004-0000-0000-0000-000000000004', 'awaiting_setup',
   '{"mfa_verified":{"done":true,"done_at":"2026-05-14T09:00:00Z","done_by":"22222222-2222-2222-2222-222222222222"},
     "template_applied":{"done":false,"done_at":null,"done_by":null},
     "welcome_sent":{"done":false,"done_at":null,"done_by":null},
     "first_appointment_booked":{"done":false,"done_at":null,"done_by":null},
     "preop_content_assigned":{"done":false,"done_at":null,"done_by":null}}'::jsonb,
   null, null, '2026-05-14T09:00:00Z'),

  -- Patient Five: MFA pending — brand new, template applied at creation.
  ('a0000005-0000-0000-0000-000000000005', 'mfa_pending',
   '{"mfa_verified":{"done":false,"done_at":null,"done_by":null},
     "template_applied":{"done":true,"done_at":"2026-05-15T09:00:00Z","done_by":"11111111-1111-1111-1111-111111111111"},
     "welcome_sent":{"done":false,"done_at":null,"done_by":null},
     "first_appointment_booked":{"done":false,"done_at":null,"done_by":null},
     "preop_content_assigned":{"done":false,"done_at":null,"done_by":null}}'::jsonb,
   null, null, '2026-05-15T09:00:00Z')
on conflict (patient_id) do nothing;

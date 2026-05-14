-- Staff-only notes, manual flags, and the audit log.

-- Internal staff notes per patient. Never visible to the patient.
-- Append-only (RLS denies UPDATE/DELETE; privileges are revoked below for
-- belt-and-suspenders).
create table public.staff_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  author_staff_id uuid not null references public.staff_users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index staff_notes_patient_id_idx on public.staff_notes (patient_id);

-- Belt-and-suspenders: deny UPDATE/DELETE at the privilege level too, so
-- even a bug that adds an UPDATE policy can't actually mutate rows.
revoke update, delete on public.staff_notes from anon, authenticated;

-- Manual elevation of a patient outside the routine check-in flow.
-- Red flags trigger the urgent alert actions while leaving the patient's
-- app view unchanged (per spec — patients never see Red).
create table public.manual_flags (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  raised_by_staff_id uuid not null references public.staff_users(id),
  alert_level public.manual_flag_level not null,
  reason text not null,
  resolved_at timestamptz,
  resolved_by_staff_id uuid references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.manual_flags
for each row execute function public.set_updated_at();

create index manual_flags_patient_id_idx on public.manual_flags (patient_id);
create index manual_flags_open_idx on public.manual_flags (alert_level)
  where resolved_at is null;

-- Immutable audit log. Every staff view/edit/message/flag/ruleset change
-- writes a row here. Retained 7 years post-discharge per CLAUDE.md.
-- INSERT-only enforced via RLS (no UPDATE/DELETE policies) AND revoked
-- privileges below.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.staff_users(id),
  actor_role text,
  event_type text not null,
  patient_id uuid references public.patients(id) on delete set null,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_events_patient_idx on public.audit_events (patient_id)
  where patient_id is not null;
create index audit_events_actor_idx on public.audit_events (actor_staff_id)
  where actor_staff_id is not null;
create index audit_events_created_idx on public.audit_events (created_at desc);

revoke update, delete on public.audit_events from anon, authenticated;

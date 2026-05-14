-- Staff users + procedure templates + per-patient procedures.

-- staff_users.id is 1:1 with auth.users.id. Staff log in via Supabase Auth
-- (email + password + TOTP MFA per CLAUDE.md). mfa_secret may be set to a
-- per-user TOTP seed if not using Supabase's built-in MFA.
create table public.staff_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role public.staff_role not null,
  mfa_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.staff_users
for each row execute function public.set_updated_at();

-- One row per (surgeon × procedure_type). Editable in dashboard
-- Procedures library; applied (with per-patient overrides) when a new
-- patient is set up.
create table public.procedure_templates (
  id uuid primary key default gen_random_uuid(),
  surgeon_id uuid not null references public.staff_users(id),
  procedure_type text not null,
  default_medications jsonb not null default '[]'::jsonb,
  default_appointments jsonb not null default '[]'::jsonb,
  default_preop_content_ids uuid[] not null default '{}',
  default_postop_content_ids uuid[] not null default '{}',
  linked_recovery_guidance_id uuid,
  linked_routing_ruleset_id uuid,
  created_by uuid references public.staff_users(id),
  updated_by uuid references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (surgeon_id, procedure_type)
);

create trigger set_updated_at
before update on public.procedure_templates
for each row execute function public.set_updated_at();

-- One row per surgical event for a patient (a patient may have multiple).
-- patient_id FK created in the next migration after patients exists.
create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  procedure_type text not null,
  eye public.eye_side not null,
  surgeon_id uuid not null references public.staff_users(id),
  surgery_date date not null,
  custom_notes text,
  status public.procedure_status not null default 'active',
  source_template_id uuid references public.procedure_templates(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.procedures
for each row execute function public.set_updated_at();

create index procedures_patient_id_idx on public.procedures (patient_id);
create index procedures_surgeon_id_idx on public.procedures (surgeon_id);

-- Patient Feedback (spec §5.9) + per-feature toggles (spec §6).
--   - partner_facilities: hospitals a patient can rate
--   - feedback: one row per rated section
--   - feature_defaults: clinic-wide default per optional feature
--   - patient_feature_flags: per-patient feature state, snapshotted from
--     feature_defaults when the patient is activated

-- ── partner_facilities ───────────────────────────────────────────────────
create table public.partner_facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  suburb text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.partner_facilities
for each row execute function public.set_updated_at();

alter table public.partner_facilities enable row level security;

create policy partner_facilities_select on public.partner_facilities
  for select using (auth.uid() is not null);
create policy partner_facilities_staff_write on public.partner_facilities
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.partner_facilities (name, suburb) values
  ('South Brisbane Day Hospital', 'South Brisbane'),
  ('Mater Day Surgery', 'South Brisbane'),
  ('Brisbane Eye Hospital', 'Spring Hill');

-- ── feedback ─────────────────────────────────────────────────────────────
-- One row per rated section. recovery_day is snapshotted at submission.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  target text not null check (target in ('clinic', 'hospital', 'app')),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  staff_mention_id uuid references public.staff_users(id),
  facility_id uuid references public.partner_facilities(id),
  contact_requested boolean not null default false,
  recovery_day integer,
  acknowledged_at timestamptz,
  acknowledged_by_staff_id uuid references public.staff_users(id),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.feedback
for each row execute function public.set_updated_at();

create index feedback_target_idx on public.feedback (target, submitted_at desc);
create index feedback_patient_idx on public.feedback (patient_id);

alter table public.feedback enable row level security;

-- A patient submits + reads their own feedback; staff read all and may
-- update (to acknowledge). No delete.
create policy feedback_patient_insert on public.feedback
  for insert with check (patient_id = auth.uid());
create policy feedback_select on public.feedback
  for select using (patient_id = auth.uid() or public.is_staff());
create policy feedback_staff_update on public.feedback
  for update using (public.is_staff()) with check (public.is_staff());

-- ── feature_defaults ─────────────────────────────────────────────────────
-- Clinic-wide default per optional patient-app feature. config holds
-- feature-specific settings (e.g. the daily check-in nudge time).
create table public.feature_defaults (
  feature_key text primary key,
  enabled boolean not null,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.staff_users(id),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.feature_defaults
for each row execute function public.set_updated_at();

alter table public.feature_defaults enable row level security;

create policy feature_defaults_select on public.feature_defaults
  for select using (auth.uid() is not null);
create policy feature_defaults_staff_write on public.feature_defaults
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.feature_defaults (feature_key, enabled, config) values
  ('surgeon_spotlight', false, '{}'::jsonb),
  ('eye_photo_prompt', true, '{}'::jsonb),
  ('checkin_nudge', true, '{"nudge_time":"14:00"}'::jsonb),
  ('lockscreen_widget', true, '{}'::jsonb),
  ('feedback_tile', true, '{}'::jsonb),
  ('preop_tile', true, '{}'::jsonb);

-- ── patient_feature_flags ────────────────────────────────────────────────
-- Per-patient feature state. changed_by_staff_id NULL = snapshotted from
-- the defaults at activation; non-NULL = an explicit staff override.
create table public.patient_feature_flags (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  config jsonb not null default '{}'::jsonb,
  changed_by_staff_id uuid references public.staff_users(id),
  changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, feature_key)
);

create trigger set_updated_at
before update on public.patient_feature_flags
for each row execute function public.set_updated_at();

create index patient_feature_flags_patient_idx
  on public.patient_feature_flags (patient_id);

alter table public.patient_feature_flags enable row level security;

create policy patient_feature_flags_select on public.patient_feature_flags
  for select using (patient_id = auth.uid() or public.is_staff());
create policy patient_feature_flags_staff_write on public.patient_feature_flags
  for all using (public.is_staff()) with check (public.is_staff());

-- ── snapshot on activation ───────────────────────────────────────────────
-- When a patient is activated, copy the current feature_defaults into
-- per-patient flag rows (changed_by_staff_id stays NULL — these are the
-- defaults-at-activation, not staff overrides). Later changes to
-- feature_defaults never touch an already-activated patient.
create or replace function public.snapshot_patient_features()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'activated' then
    insert into public.patient_feature_flags
      (patient_id, feature_key, enabled, config)
    select new.patient_id, fd.feature_key, fd.enabled, fd.config
    from public.feature_defaults fd
    where not exists (
      select 1 from public.patient_feature_flags pf
      where pf.patient_id = new.patient_id
        and pf.feature_key = fd.feature_key
    );
  end if;
  return new;
end;
$$;

create trigger snapshot_patient_features
after insert or update on public.patient_setup_tasks
for each row execute function public.snapshot_patient_features();

-- Backfill: snapshot features for patients already activated before this
-- migration, so the feature works for existing test data.
insert into public.patient_feature_flags
  (patient_id, feature_key, enabled, config)
select t.patient_id, fd.feature_key, fd.enabled, fd.config
from public.patient_setup_tasks t
cross join public.feature_defaults fd
where t.status = 'activated'
on conflict (patient_id, feature_key) do nothing;

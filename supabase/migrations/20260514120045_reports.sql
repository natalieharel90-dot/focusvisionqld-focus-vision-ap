-- Reports section (spec §Reports). generated_reports stores each report's
-- type + parameters; the computed data JSON is filled lazily when the
-- report is first viewed (period-bounded, so deterministic). report_
-- schedules drives the monthly pg_cron auto-generation.

-- ── generated_reports ────────────────────────────────────────────────────
create table public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null
    check (report_type in ('monthly_activity', 'surgeon', 'compliance', 'cohort')),
  parameters jsonb not null default '{}'::jsonb,
  -- Computed report data; null until first rendered, then cached.
  data jsonb,
  include_identifiers boolean not null default false,
  auto_generated boolean not null default false,
  generated_by_staff_id uuid references public.staff_users(id),
  generated_at timestamptz not null default now()
);

create index generated_reports_type_idx
  on public.generated_reports (report_type, generated_at desc);

alter table public.generated_reports enable row level security;

-- Staff-only. The tier-3 (Reception) block is enforced in the page +
-- actions, not RLS — reception is still staff.
create policy generated_reports_staff_all on public.generated_reports
  for all using (public.is_staff()) with check (public.is_staff());

-- ── report_schedules ─────────────────────────────────────────────────────
-- One row per report type; enabled = auto-generate on the 1st monthly.
create table public.report_schedules (
  report_type text primary key
    check (report_type in ('monthly_activity', 'surgeon', 'compliance', 'cohort')),
  enabled boolean not null default false,
  parameters jsonb not null default '{}'::jsonb,
  include_identifiers boolean not null default false,
  updated_by uuid references public.staff_users(id),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.report_schedules
for each row execute function public.set_updated_at();

alter table public.report_schedules enable row level security;

create policy report_schedules_staff_all on public.report_schedules
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.report_schedules (report_type) values
  ('monthly_activity'), ('surgeon'), ('compliance'), ('cohort');

-- ── Scheduled generation ─────────────────────────────────────────────────
-- Inserts a queued generated_reports row for every enabled schedule. The
-- data JSON stays null and is computed when the report is first opened.
create or replace function public.generate_scheduled_reports()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.generated_reports
    (report_type, parameters, include_identifiers, auto_generated)
  select s.report_type, s.parameters, s.include_identifiers, true
  from public.report_schedules s
  where s.enabled = true;
end;
$$;

-- Generated reports are retained 12 months, then pruned.
create or replace function public.prune_old_reports()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.generated_reports
  where generated_at < now() - interval '12 months';
end;
$$;

revoke all on function public.generate_scheduled_reports() from public;
revoke all on function public.prune_old_reports() from public;

-- 1st of each month, 06:00 — generate; daily 03:00 — prune.
select cron.schedule(
  'generate-scheduled-reports',
  '0 6 1 * *',
  $$ select public.generate_scheduled_reports(); $$
);
select cron.schedule(
  'prune-old-reports',
  '0 3 * * *',
  $$ select public.prune_old_reports(); $$
);

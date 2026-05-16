-- Analytics dashboard customisation:
--  • analytics_targets — clinic-wide goal percentages shown on the stat
--    cards. A singleton row (id can only ever be true).
--  • staff_analytics_layout — each staff member's preferred order of the
--    eight quick-view stat cards.

create table public.analytics_targets (
  id boolean primary key default true check (id),
  checkin_completion_pct int not null default 75
    check (checkin_completion_pct between 0 and 100),
  medication_adherence_pct int not null default 90
    check (medication_adherence_pct between 0 and 100),
  staff_response_hours numeric(5, 1) not null default 4.0
    check (staff_response_hours >= 0),
  red_alert_rate_pct int not null default 5
    check (red_alert_rate_pct between 0 and 100),
  updated_by uuid references public.staff_users(id),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.analytics_targets
for each row execute function public.set_updated_at();

alter table public.analytics_targets enable row level security;

-- Clinic-wide goals — any staff member can read and adjust them.
create policy analytics_targets_staff_all on public.analytics_targets
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.analytics_targets (id) values (true);

-- ── Per-staff stat-card order ─────────────────────────────────────────────
create table public.staff_analytics_layout (
  staff_id uuid primary key references public.staff_users(id) on delete cascade,
  card_order text[] not null,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.staff_analytics_layout
for each row execute function public.set_updated_at();

alter table public.staff_analytics_layout enable row level security;

-- A staff member only ever sees and writes their own layout row.
create policy staff_analytics_layout_own on public.staff_analytics_layout
  for all using (staff_id = auth.uid()) with check (staff_id = auth.uid());

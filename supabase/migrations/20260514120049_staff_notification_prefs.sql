-- Per-staff notification preferences, surfaced on the Messages page.
-- One row per staff member; each toggles their own push / digest options.

create table public.staff_notification_prefs (
  staff_id uuid primary key references public.staff_users(id) on delete cascade,
  notify_new_message boolean not null default true,
  notify_orange_flag boolean not null default true,
  notify_yellow_flag boolean not null default false,
  quiet_hours boolean not null default true,
  daily_digest_email boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.staff_notification_prefs
for each row execute function public.set_updated_at();

alter table public.staff_notification_prefs enable row level security;

-- A staff member only ever reads and writes their own preferences row.
create policy staff_notification_prefs_own on public.staff_notification_prefs
  for all using (staff_id = auth.uid()) with check (staff_id = auth.uid());

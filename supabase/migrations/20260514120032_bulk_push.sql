-- Bulk push to cohorts (spec §6.12). Staff send one message to a filtered
-- cohort of patients; each recipient gets an ordinary message in their
-- existing thread. Scheduled pushes are fired by a pg_cron job.

-- ── bulk_pushes ──────────────────────────────────────────────────────────
-- One row per composed push. content_type allows 'content'/'both' for a
-- future content library; only 'message' is produced today.
create table public.bulk_pushes (
  id uuid primary key default gen_random_uuid(),
  sender_staff_id uuid not null references public.staff_users(id),
  cohort_filter jsonb not null,
  cohort_summary text not null,
  content_type text not null default 'message'
    check (content_type in ('message', 'content', 'both')),
  message_title text not null,
  message_body text not null,
  -- send-now stores now(); 'schedule for later' stores the future time.
  scheduled_at timestamptz not null,
  -- set when the fan-out has run; null means not yet sent.
  fired_at timestamptz,
  patients_reached integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.bulk_pushes
for each row execute function public.set_updated_at();

create index bulk_pushes_due_idx on public.bulk_pushes (scheduled_at)
  where fired_at is null;
create index bulk_pushes_created_idx on public.bulk_pushes (created_at desc);

-- messages carries a back-reference so the patient app can label bulk-push
-- messages "Focus Vision team" and the open-sync trigger can find deliveries.
alter table public.messages
  add column bulk_push_id uuid references public.bulk_pushes(id) on delete set null;

-- ── bulk_push_deliveries ─────────────────────────────────────────────────
-- One row per recipient. Rows are written by fire_bulk_push() only.
create table public.bulk_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  bulk_push_id uuid not null references public.bulk_pushes(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  recovery_day integer,
  status text not null default 'delivered'
    check (status in ('delivered', 'failed')),
  delivered_at timestamptz not null default now(),
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bulk_push_id, patient_id)
);

create index bulk_push_deliveries_push_idx on public.bulk_push_deliveries (bulk_push_id);
create index bulk_push_deliveries_message_idx on public.bulk_push_deliveries (message_id);
create index bulk_push_deliveries_patient_idx on public.bulk_push_deliveries (patient_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Patients have NO access to either table — they only ever see the
-- delivered message via the existing messages RLS. Staff read both;
-- only access_tier <= 2 can insert a push (matched by the server action).
alter table public.bulk_pushes enable row level security;
alter table public.bulk_push_deliveries enable row level security;

create policy bulk_pushes_staff_select on public.bulk_pushes
  for select using (public.is_staff());
create policy bulk_pushes_sender_insert on public.bulk_pushes
  for insert with check (
    public.is_staff()
    and sender_staff_id = auth.uid()
    and exists (
      select 1 from public.staff_users s
      where s.id = auth.uid() and s.access_tier <= 2
    )
  );

create policy bulk_push_deliveries_staff_select on public.bulk_push_deliveries
  for select using (public.is_staff());

-- ── Cohort evaluation ────────────────────────────────────────────────────
-- Resolves a cohort_filter JSON to the matching patient ids + recovery day.
-- Mirrors selectCohort() in src/lib/bulk-push.ts — keep the two in sync.
-- A patient matches on their most-recent active procedure.
create or replace function public.bulk_push_cohort(p_filter jsonb)
returns table (patient_id uuid, recovery_day integer)
language sql
stable
security definer
set search_path = public
as $$
  with active_proc as (
    select distinct on (pr.patient_id)
      pr.patient_id,
      pr.procedure_type,
      pr.surgeon_id,
      pr.surgery_date
    from public.procedures pr
    where pr.status = 'active'
    order by pr.patient_id, pr.surgery_date desc
  ),
  last_zone as (
    select distinct on (c.patient_id)
      c.patient_id, c.patient_zone
    from public.check_ins c
    order by c.patient_id, c.created_at desc
  )
  select
    ap.patient_id,
    (((now() at time zone 'Australia/Brisbane')::date) - ap.surgery_date)::integer
      as recovery_day
  from active_proc ap
  left join last_zone lz on lz.patient_id = ap.patient_id
  where
    (
      p_filter->'procedures' is null
      or jsonb_typeof(p_filter->'procedures') <> 'array'
      or jsonb_array_length(p_filter->'procedures') = 0
      or ap.procedure_type in (
        select jsonb_array_elements_text(p_filter->'procedures')
      )
    )
    and (
      p_filter->'surgeonIds' is null
      or jsonb_typeof(p_filter->'surgeonIds') <> 'array'
      or jsonb_array_length(p_filter->'surgeonIds') = 0
      or ap.surgeon_id::text in (
        select jsonb_array_elements_text(p_filter->'surgeonIds')
      )
    )
    and (
      p_filter->>'recoveryDayMin' is null
      or (((now() at time zone 'Australia/Brisbane')::date) - ap.surgery_date)
         >= (p_filter->>'recoveryDayMin')::integer
    )
    and (
      p_filter->>'recoveryDayMax' is null
      or (((now() at time zone 'Australia/Brisbane')::date) - ap.surgery_date)
         <= (p_filter->>'recoveryDayMax')::integer
    )
    and (
      p_filter->>'surgeryDateFrom' is null
      or ap.surgery_date >= (p_filter->>'surgeryDateFrom')::date
    )
    and (
      p_filter->>'surgeryDateTo' is null
      or ap.surgery_date <= (p_filter->>'surgeryDateTo')::date
    )
    and (
      coalesce(p_filter->>'flagStatus', 'any') = 'any'
      or (
        p_filter->>'flagStatus' = 'none'
        and not exists (
          select 1 from public.manual_flags mf
          where mf.patient_id = ap.patient_id and mf.resolved_at is null
        )
      )
      or (
        p_filter->>'flagStatus' in ('yellow', 'orange', 'red')
        and exists (
          select 1 from public.manual_flags mf
          where mf.patient_id = ap.patient_id
            and mf.resolved_at is null
            and mf.alert_level::text = p_filter->>'flagStatus'
        )
      )
    )
    and (
      coalesce(p_filter->>'lastCheckInZone', 'any') = 'any'
      or lz.patient_zone::text = p_filter->>'lastCheckInZone'
    );
$$;

-- ── Fan-out ──────────────────────────────────────────────────────────────
-- Core fan-out for one push: evaluate the cohort, deliver one message into
-- each recipient's thread, write delivery rows, stamp fired_at. Idempotent.
-- Internal only — not granted to authenticated.
create or replace function public.fire_bulk_push(p_push_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_push public.bulk_pushes;
  v_row record;
  v_thread_id uuid;
  v_message_id uuid;
  v_body text;
  v_count integer := 0;
begin
  select * into v_push from public.bulk_pushes where id = p_push_id for update;
  if not found or v_push.fired_at is not null then
    return;
  end if;

  v_body := v_push.message_title || E'\n\n' || v_push.message_body;

  for v_row in
    select * from public.bulk_push_cohort(v_push.cohort_filter)
  loop
    select id into v_thread_id
    from public.message_threads
    where message_threads.patient_id = v_row.patient_id;

    if v_thread_id is null then
      insert into public.message_threads (patient_id)
      values (v_row.patient_id)
      returning id into v_thread_id;
    end if;

    insert into public.messages
      (thread_id, sender_type, sender_id, body, bulk_push_id)
    values
      (v_thread_id, 'staff', v_push.sender_staff_id, v_body, p_push_id)
    returning id into v_message_id;

    update public.message_threads
    set last_message_at = now(),
        unread_for_patient = unread_for_patient + 1
    where id = v_thread_id;

    insert into public.bulk_push_deliveries
      (bulk_push_id, patient_id, message_id, recovery_day, status, delivered_at)
    values
      (p_push_id, v_row.patient_id, v_message_id, v_row.recovery_day,
       'delivered', now())
    on conflict (bulk_push_id, patient_id) do nothing;

    v_count := v_count + 1;
  end loop;

  update public.bulk_pushes
  set fired_at = now(), patients_reached = v_count
  where id = p_push_id;
end;
$$;

-- Fires every push whose scheduled_at has passed and that hasn't fired yet.
-- Called by pg_cron. Not auth-guarded — runs as the cron job owner.
create or replace function public.fire_due_bulk_pushes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.bulk_pushes
    where fired_at is null and scheduled_at <= now()
    order by scheduled_at
  loop
    perform public.fire_bulk_push(v_id);
  end loop;
end;
$$;

-- Staff-callable wrapper for "Send now": guards on staff identity, then
-- fires immediately. The server action also enforces access_tier <= 2.
create or replace function public.send_bulk_push_now(p_push_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  perform public.fire_bulk_push(p_push_id);
end;
$$;

revoke all on function public.bulk_push_cohort(jsonb) from public;
revoke all on function public.fire_bulk_push(uuid) from public;
revoke all on function public.fire_due_bulk_pushes() from public;
revoke all on function public.send_bulk_push_now(uuid) from public;
grant execute on function public.send_bulk_push_now(uuid) to authenticated;

-- ── Open tracking ────────────────────────────────────────────────────────
-- When a patient reads a delivered message (messages.read_at set by the
-- patient app), mirror the timestamp onto its delivery row. SECURITY
-- DEFINER so the patient never needs any privilege on bulk_push_deliveries.
create or replace function public.sync_bulk_push_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.read_at is not null and old.read_at is null then
    update public.bulk_push_deliveries
    set opened_at = new.read_at
    where message_id = new.id and opened_at is null;
  end if;
  return new;
end;
$$;

create trigger sync_bulk_push_open
after update of read_at on public.messages
for each row execute function public.sync_bulk_push_open();

-- ── Scheduler ────────────────────────────────────────────────────────────
-- pg_cron fires due scheduled pushes every 5 minutes.
create extension if not exists pg_cron;

select cron.schedule(
  'fire-due-bulk-pushes',
  '*/5 * * * *',
  $$ select public.fire_due_bulk_pushes(); $$
);

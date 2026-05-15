-- Patient app preferences: theme, dark mode, accessibility, language,
-- notification toggles. One row per patient.

create table public.user_preferences (
  patient_id uuid primary key
    references public.patients(id) on delete cascade,
  theme text not null default 'calm'
    check (theme in ('calm', 'premium', 'bright', 'terracotta', 'minimal')),
  dark_mode boolean not null default false,
  text_size text not null default 'normal'
    check (text_size in ('small', 'normal', 'large')),
  high_contrast boolean not null default false,
  reduce_motion boolean not null default false,
  language text not null default 'en'
    check (language in ('en', 'zh', 'vi', 'ar')),
  notify_medication boolean not null default true,
  notify_checkin boolean not null default true,
  notify_messages boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

-- A patient fully manages their own preferences row.
create policy user_preferences_self on public.user_preferences
  for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- Staff can read (e.g. support: "why did the app look different?").
create policy user_preferences_staff_read on public.user_preferences
  for select using (public.is_staff());

-- ── record_patient_audit ─────────────────────────────────────────────────
-- audit_events.actor_staff_id is a staff FK; patient-initiated events
-- (like a theme change) can't be inserted under the staff-only RLS
-- policy. This SECURITY DEFINER function records a patient-actor audit
-- row (actor_staff_id NULL, actor_role 'patient', patient_id = caller).
create or replace function public.record_patient_audit(
  p_event_type text,
  p_new_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.patients where id = v_uid) then
    raise exception 'not_a_patient';
  end if;

  insert into public.audit_events (
    actor_staff_id, actor_role, event_type,
    patient_id, entity_type, new_value
  ) values (
    null, 'patient', p_event_type,
    v_uid, 'user_preferences', p_new_value
  );
end;
$$;

revoke all on function public.record_patient_audit(text, jsonb) from public;
grant execute on function public.record_patient_audit(text, jsonb) to authenticated;

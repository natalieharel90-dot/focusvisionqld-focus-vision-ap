-- Patient-side medication dose support: idempotent today-row generation
-- and a uniqueness constraint to enforce one dose per (medication, time).

-- Prevent duplicate rows for the same medication at the same scheduled
-- time. The lazy ensure_todays_doses flow relies on this for upsert.
alter table public.medication_doses
  add constraint medication_doses_unique_per_time
  unique (medication_id, scheduled_at);

-- SECURITY DEFINER so a patient can create their own today's reminder
-- rows on first visit to /medications. Under regular RLS, INSERT on
-- medication_doses is staff-only; that's the right default for clinical
-- writes, but patient-driven generation needs a controlled escape hatch.
-- The function self-checks auth.uid() = p_patient_id (or staff) so a
-- patient can't generate doses for someone else.
--
-- Schedule strings are stored on medications as text[] like {"08:00",
-- "12:00"}. They're interpreted as local wall-clock time in
-- Australia/Brisbane (the clinic's timezone — no DST), then converted
-- to timestamptz.
create or replace function public.ensure_todays_doses(p_patient_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_today date;
  v_med record;
  v_time text;
  v_scheduled_at timestamptz;
  v_inserted integer := 0;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_uid <> p_patient_id and not public.is_staff() then
    raise exception 'forbidden';
  end if;

  v_today := (timezone('Australia/Brisbane', now()))::date;

  for v_med in
    select id, scheduled_times
    from public.medications
    where patient_id = p_patient_id
      and stopped_at is null
      and start_date <= v_today
      and (end_date is null or end_date >= v_today)
  loop
    if v_med.scheduled_times is null then continue; end if;
    foreach v_time in array v_med.scheduled_times
    loop
      v_scheduled_at :=
        ((v_today::text || ' ' || v_time)::timestamp)
        at time zone 'Australia/Brisbane';
      insert into public.medication_doses (medication_id, scheduled_at)
      values (v_med.id, v_scheduled_at)
      on conflict (medication_id, scheduled_at) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end loop;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.ensure_todays_doses(uuid) from public;
grant execute on function public.ensure_todays_doses(uuid) to authenticated;

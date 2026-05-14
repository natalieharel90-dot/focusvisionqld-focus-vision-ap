-- Fix ensure_todays_doses so it generates today's reminder rows for a
-- medication ONLY when no dose exists for that medication today. The
-- previous version checked each scheduled time individually and would
-- recreate a fresh dose at the original time after the patient snoozed
-- one — leaving them with duplicate morning rows that eventually
-- collided with the unique constraint when snoozed further.

create or replace function public.ensure_todays_doses(p_patient_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_today date;
  v_start timestamptz;
  v_end timestamptz;
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
  v_start := (v_today::text)::timestamp at time zone 'Australia/Brisbane';
  v_end   := ((v_today + 1)::text)::timestamp at time zone 'Australia/Brisbane';

  -- Only generate for medications that have NO doses anywhere in today's
  -- window. Once any dose exists (whether original, snoozed, or taken),
  -- skip — that medication is already "set up" for today.
  for v_med in
    select m.id, m.scheduled_times
    from public.medications m
    where m.patient_id = p_patient_id
      and m.stopped_at is null
      and m.start_date <= v_today
      and (m.end_date is null or m.end_date >= v_today)
      and not exists (
        select 1 from public.medication_doses d
        where d.medication_id = m.id
          and d.scheduled_at >= v_start
          and d.scheduled_at < v_end
      )
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

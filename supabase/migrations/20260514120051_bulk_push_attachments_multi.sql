-- Bulk push supports multiple mixed-type attachments (image, video or
-- document), so the single attachment_path becomes an array. No rows
-- carry the old column yet, so dropping it is safe.

alter table public.bulk_pushes drop column attachment_path;
alter table public.bulk_pushes
  add column attachment_paths text[] not null default '{}';

-- Re-create fire_bulk_push so each delivered message carries the push's
-- full list of attachments.
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
  v_attachments jsonb;
  v_count integer := 0;
begin
  select * into v_push from public.bulk_pushes where id = p_push_id for update;
  if not found or v_push.fired_at is not null then
    return;
  end if;

  v_body := v_push.message_title || E'\n\n' || v_push.message_body;
  v_attachments := to_jsonb(v_push.attachment_paths);

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
      (thread_id, sender_type, sender_id, body, attachments, bulk_push_id)
    values
      (v_thread_id, 'staff', v_push.sender_staff_id, v_body,
       v_attachments, p_push_id)
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

-- Keep message_threads.unread_for_staff and unread_for_patient in sync
-- with the messages log.
--
-- mark_thread_read already zeroes these on read. The missing half was
-- the INSERT increment — without it the per-thread red dot in the
-- staff mobile app (and the staff-app bottom-nav messages badge) never
-- appeared. Same for the patient-side counter, except bulk pushes
-- already bumped that one explicitly.
--
-- The trigger skips rows that have a bulk_push_id — those go through
-- bulk_push_fire which bumps unread_for_patient itself, so a generic
-- trigger would double-count them.

create or replace function public.bump_thread_unread_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bulk_push_id is not null then
    return new;
  end if;

  if new.sender_type = 'patient' then
    update public.message_threads
      set unread_for_staff = unread_for_staff + 1
      where id = new.thread_id;
  elsif new.sender_type = 'staff' then
    update public.message_threads
      set unread_for_patient = unread_for_patient + 1
      where id = new.thread_id;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_bump_thread_unread on public.messages;
create trigger messages_bump_thread_unread
after insert on public.messages
for each row
execute function public.bump_thread_unread_on_message_insert();

-- Backfill existing counters from the message log so the badge is
-- accurate from the moment this migration runs.
update public.message_threads t
set
  unread_for_staff = coalesce((
    select count(*) from public.messages m
    where m.thread_id = t.id
      and m.sender_type = 'patient'
      and m.read_at is null
  ), 0),
  unread_for_patient = coalesce((
    select count(*) from public.messages m
    where m.thread_id = t.id
      and m.sender_type = 'staff'
      and m.read_at is null
  ), 0);

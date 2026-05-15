-- Patients have no UPDATE policy on messages / message_threads, so the
-- patient app's direct "mark thread read" updates were silently no-ops
-- (RLS blocked them — 0 rows, no error). That left messages.read_at unset,
-- which also meant bulk-push open tracking (sync_bulk_push_open, which
-- fires on read_at) never registered an open.
--
-- This SECURITY DEFINER function is the patient's guarded path: it marks
-- the thread's inbound staff messages read and clears the patient unread
-- counter, but only for a thread the caller actually owns.

create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.message_threads t
    where t.id = p_thread_id and t.patient_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  update public.messages
  set read_at = now()
  where thread_id = p_thread_id
    and sender_type = 'staff'
    and read_at is null;

  update public.message_threads
  set unread_for_patient = 0
  where id = p_thread_id;
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public;
grant execute on function public.mark_thread_read(uuid) to authenticated;

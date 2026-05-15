-- Extend mark_thread_read to the staff inbox. Staff also have no UPDATE
-- policy on messages, so the staff inbox's "mark patient messages read"
-- was silently a no-op too. The function now branches on the caller:
--   - the patient who owns the thread → marks staff messages read
--   - any other staff member        → marks patient messages read
-- Same signature, so existing callers (the patient app) are unaffected.

create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.message_threads t
    where t.id = p_thread_id and t.patient_id = auth.uid()
  ) then
    update public.messages
    set read_at = now()
    where thread_id = p_thread_id
      and sender_type = 'staff'
      and read_at is null;

    update public.message_threads
    set unread_for_patient = 0
    where id = p_thread_id;

  elsif public.is_staff() then
    update public.messages
    set read_at = now()
    where thread_id = p_thread_id
      and sender_type = 'patient'
      and read_at is null;

    update public.message_threads
    set unread_for_staff = 0
    where id = p_thread_id;

  else
    raise exception 'forbidden';
  end if;
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public;
grant execute on function public.mark_thread_read(uuid) to authenticated;

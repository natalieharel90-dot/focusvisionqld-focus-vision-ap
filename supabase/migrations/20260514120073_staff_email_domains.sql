-- Allow a second staff email domain. Staff registering via /sign-up may
-- use a Focus Vision address or a Queensland Eye Institute (qei.org.au)
-- address — clinical staff are affiliated with both.
create or replace function public.create_staff_user(
  p_name text,
  p_role text
)
returns public.staff_users
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_email text;
  v_row public.staff_users;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_email := (auth.jwt() ->> 'email');
  if v_email is null
     or v_email !~* '@(focusvision\.com\.au|qei\.org\.au)$' then
    raise exception 'invalid_staff_email_domain';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'name_required';
  end if;

  insert into public.staff_users (id, email, name, role, display_name)
  values (
    v_uid, v_email, btrim(p_name), lower(btrim(p_role)), btrim(p_name)
  )
  on conflict (id) do update
    set name = excluded.name,
        role = excluded.role,
        display_name = excluded.display_name,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_staff_user(text, text) from public;
grant execute on function public.create_staff_user(text, text) to authenticated;

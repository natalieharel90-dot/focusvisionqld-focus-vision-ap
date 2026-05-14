-- SECURITY DEFINER function so a freshly-signed-up auth.users record can
-- bootstrap its own staff_users row. The normal RLS policy requires
-- is_staff() = true, which the new user isn't yet — chicken-and-egg.
-- This function runs as the function owner (postgres) and bypasses RLS.
--
-- Email is pulled from the JWT, not a parameter, so the caller can't claim
-- to be a different identity. Domain is enforced server-side as defense
-- in depth (the app layer also checks before calling).

create or replace function public.create_staff_user(
  p_name text,
  p_role public.staff_role
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
  if v_email is null or v_email !~* '@focusvision\.com\.au$' then
    raise exception 'invalid_staff_email_domain';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'name_required';
  end if;

  insert into public.staff_users (id, email, name, role)
  values (v_uid, v_email, btrim(p_name), p_role)
  on conflict (id) do update
    set name = excluded.name,
        role = excluded.role,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- Only authenticated users (i.e. holders of a valid Supabase JWT) can call
-- this. The function itself further enforces the domain check via the JWT
-- email claim.
revoke all on function public.create_staff_user(text, public.staff_role) from public;
grant execute on function public.create_staff_user(text, public.staff_role) to authenticated;

-- Fold the doctors roster into staff_users — step 1 of 3 (schema only).
--
-- Extends staff_users with the roster fields and converts the role
-- column off the fixed staff_role enum so the dynamic staff_roles list
-- can drive it. The data backfill — merging doctors rows by email and
-- creating auth accounts for unmatched ones — runs separately as
-- scripts/unify-doctors.ts. The doctors table is dropped in a follow-up
-- migration once that backfill has completed successfully.

-- ── New roster columns on staff_users (all nullable / defaulted) ─────────
-- `active` is not in the original column list but is required by the
-- surgeon dropdown query (role = 'surgeon' AND active = true) and the
-- soft-delete behaviour, so it is added here.
alter table public.staff_users
  add column display_name text,
  add column photo_url text,
  add column bio text,
  add column welcome_video_url text,
  add column phone text,
  add column is_invited_only boolean not null default false,
  add column active boolean not null default true;

-- Seed display_name from the existing name so no row is left null. The
-- backfill script overwrites this where a matching doctors row exists.
update public.staff_users
  set display_name = name
  where display_name is null;

-- ── Free the role column from the fixed enum ────────────────────────────
-- staff_roles is a runtime-editable table, so role validation stays
-- app-enforced: a static CHECK can't track a dynamic list, and an enum
-- can't gain values (e.g. "manager") at runtime. create_staff_user is
-- dropped and recreated because its signature references the enum type.
drop function if exists public.create_staff_user(text, public.staff_role);

alter table public.staff_users
  alter column role type text using lower(role::text);

drop type public.staff_role;

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
  if v_email is null or v_email !~* '@focusvision\.com\.au$' then
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

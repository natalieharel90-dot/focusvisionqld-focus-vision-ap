-- Fix the staff "Add patient" flow. create_patient_auth_user hashes the
-- temporary password with pgcrypto's crypt()/gen_salt(), but pgcrypto is
-- installed in the `extensions` schema and the function's search_path
-- only had `public, auth` — so the calls failed with
--   "function gen_salt(unknown) does not exist".
-- Recreate the function with `extensions` on the search_path.

create or replace function public.create_patient_auth_user(
  p_email text,
  p_password text
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  if p_email is null or btrim(p_email) = '' then
    raise exception 'email_required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'password_too_short';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current, email_change,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    btrim(p_email), crypt(p_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id, v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', btrim(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  return v_user_id;
end;
$$;

revoke all on function public.create_patient_auth_user(text, text) from public;
grant execute on function public.create_patient_auth_user(text, text) to authenticated;

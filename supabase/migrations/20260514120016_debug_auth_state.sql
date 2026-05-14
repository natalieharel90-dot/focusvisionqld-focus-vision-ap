-- Diagnostic migration: prints the current auth state for seed users so
-- we can see why sign-in is failing. This is a no-op data change; only
-- RAISE NOTICE output goes to the db push log.

do $$
declare
  total_users int;
  total_idents int;
  u record;
begin
  select count(*) into total_users
  from auth.users
  where id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'a0000001-0000-0000-0000-000000000001',
    'a0000002-0000-0000-0000-000000000002',
    'a0000003-0000-0000-0000-000000000003',
    'a0000004-0000-0000-0000-000000000004',
    'a0000005-0000-0000-0000-000000000005'
  );
  raise notice 'seed auth.users count: %', total_users;

  select count(*) into total_idents
  from auth.identities
  where user_id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'a0000001-0000-0000-0000-000000000001',
    'a0000002-0000-0000-0000-000000000002',
    'a0000003-0000-0000-0000-000000000003',
    'a0000004-0000-0000-0000-000000000004',
    'a0000005-0000-0000-0000-000000000005'
  );
  raise notice 'seed auth.identities count: %', total_idents;

  -- Show what columns the seed users have set vs null.
  for u in
    select id, email,
           email_confirmed_at is not null as email_confirmed,
           encrypted_password is not null as has_password,
           length(encrypted_password) as pw_len,
           aud, role,
           confirmation_token, recovery_token,
           email_change_token_new, email_change_token_current
    from auth.users
    where id = 'a0000005-0000-0000-0000-000000000005'
  loop
    raise notice 'patient.five row: email=%, confirmed=%, has_pw=%, pw_len=%, aud=%, role=%, conf_tok=[%], rec_tok=[%], ect_new=[%], ect_cur=[%]',
      u.email, u.email_confirmed, u.has_password, u.pw_len, u.aud, u.role,
      u.confirmation_token, u.recovery_token,
      u.email_change_token_new, u.email_change_token_current;
  end loop;
end $$;

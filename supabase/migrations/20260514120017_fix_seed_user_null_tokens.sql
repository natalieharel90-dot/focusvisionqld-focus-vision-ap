-- Fix seed users by replacing NULL token columns with empty strings.
--
-- The seed in earlier migrations INSERTed into auth.users without setting
-- confirmation_token / recovery_token / email_change_token_new etc.,
-- expecting them to default to ''. They actually defaulted to NULL,
-- which causes Supabase Auth (GoTrue) to fail with "Database error
-- querying schema" on every sign-in for those users.
--
-- Idempotent: targets only the well-known seed UUIDs and uses COALESCE.

update auth.users
   set confirmation_token       = coalesce(confirmation_token, ''),
       recovery_token            = coalesce(recovery_token, ''),
       email_change_token_new    = coalesce(email_change_token_new, ''),
       email_change_token_current = coalesce(email_change_token_current, ''),
       email_change              = coalesce(email_change, ''),
       phone_change              = coalesce(phone_change, ''),
       phone_change_token        = coalesce(phone_change_token, ''),
       reauthentication_token    = coalesce(reauthentication_token, '')
 where id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'a0000001-0000-0000-0000-000000000001',
   'a0000002-0000-0000-0000-000000000002',
   'a0000003-0000-0000-0000-000000000003',
   'a0000004-0000-0000-0000-000000000004',
   'a0000005-0000-0000-0000-000000000005'
 );

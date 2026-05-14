-- Backfill auth.identities for the seed-inserted staff + patient users.
--
-- Newer Supabase Auth (GoTrue) requires an auth.identities row linking
-- each user to their identity provider. The seed in earlier migrations
-- only wrote auth.users rows — sign-in for those users failed with
-- "Database error querying schema" because the lookup join is empty.
--
-- Safe to re-run: ON CONFLICT against the (provider_id, provider) unique.
-- Only targets the well-known seed UUIDs, so this is a no-op anywhere
-- the seed wasn't loaded (e.g. production).

insert into auth.identities (
  user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  u.id,
  u.id::text,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'a0000001-0000-0000-0000-000000000001',
  'a0000002-0000-0000-0000-000000000002',
  'a0000003-0000-0000-0000-000000000003',
  'a0000004-0000-0000-0000-000000000004',
  'a0000005-0000-0000-0000-000000000005'
)
on conflict (provider_id, provider) do nothing;

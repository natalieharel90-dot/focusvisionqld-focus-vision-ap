-- The generated `name` column is trim(first_name || ' ' || last_name) and
-- both parts are NOT NULL, so name is never null. Declaring NOT NULL makes
-- that explicit — and keeps the generated TypeScript type as `string`
-- rather than `string | null`, so the ~100 sites reading patients.name
-- need no changes.
alter table public.patients alter column name set not null;

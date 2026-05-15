-- Split patients.name into first_name + last_name. The old single `name`
-- column is re-added as a STORED generated column so the ~100 existing
-- call sites that read patients.name keep working unchanged — and the
-- generated value can never drift from its parts.

-- 1. Add the parts, nullable for now so the backfill can populate them.
alter table public.patients add column first_name text;
alter table public.patients add column last_name text;

-- 2. Backfill from the existing name. Heuristic: first word is the first
--    name, the remainder is the surname. Single-word names get an empty
--    surname (kept, not dropped).
update public.patients set
  first_name = trim(split_part(name, ' ', 1)),
  last_name = case
    when position(' ' in name) > 0
      then trim(substring(name from position(' ' in name) + 1))
    else ''
  end;

-- 3. Guard: the backfill must have given every row a first name. If a row
--    slipped through (e.g. a name that was entirely whitespace), fail the
--    migration loudly rather than create a NOT NULL violation below.
do $$
declare
  bad_count int;
begin
  select count(*) into bad_count
  from public.patients
  where first_name is null or first_name = '' or last_name is null;
  if bad_count > 0 then
    raise exception
      'Name backfill left % patient row(s) without a usable name', bad_count;
  end if;
end $$;

-- 4. Lock the parts down. Default '' guards against future inserts that
--    forget a part — better an empty string than a NULL.
alter table public.patients alter column first_name set default '';
alter table public.patients alter column first_name set not null;
alter table public.patients alter column last_name set default '';
alter table public.patients alter column last_name set not null;

-- 5. Replace name with a generated column. The matview in the analytics
--    migration only references patients.id, so this drop does not cascade.
alter table public.patients drop column name;
alter table public.patients add column name text
  generated always as (trim(first_name || ' ' || last_name)) stored;

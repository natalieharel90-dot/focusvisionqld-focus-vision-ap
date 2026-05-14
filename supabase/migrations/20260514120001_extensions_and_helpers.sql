-- Extensions and shared helper functions used across the schema.

create extension if not exists pgcrypto with schema extensions;

-- BEFORE UPDATE trigger function: set updated_at = now() on every update.
-- Wired onto each table that has an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

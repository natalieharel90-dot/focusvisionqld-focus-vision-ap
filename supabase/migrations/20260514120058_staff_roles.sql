-- Staff roster roles become a managed, extensible list — staff can add
-- new roles in Settings → Clinic & Staff. doctors.role can therefore no
-- longer be constrained to a fixed set.

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.staff_roles
for each row execute function public.set_updated_at();

alter table public.staff_roles enable row level security;

create policy staff_roles_select on public.staff_roles
  for select using (auth.uid() is not null);
create policy staff_roles_staff_write on public.staff_roles
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.staff_roles (name) values
  ('Surgeon'), ('Optometrist'), ('Nurse'), ('Reception'), ('Manager');

alter table public.doctors
  drop constraint doctors_role_check;

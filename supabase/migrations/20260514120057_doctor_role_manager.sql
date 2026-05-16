-- Add "Manager" to the staff roster roles (doctors table).
alter table public.doctors
  drop constraint doctors_role_check;

alter table public.doctors
  add constraint doctors_role_check
  check (role in ('Surgeon', 'Optometrist', 'Nurse', 'Reception', 'Manager'));

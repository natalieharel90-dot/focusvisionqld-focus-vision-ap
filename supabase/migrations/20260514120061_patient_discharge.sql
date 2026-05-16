-- Explicit patient discharge. Until now "discharged" was derived from a
-- patient having no active procedure; staff can now discharge a patient
-- directly, which takes them out of the active-recovery lists.
alter table public.patients
  add column discharged_at timestamptz,
  add column discharged_by_staff_id uuid references public.staff_users(id);

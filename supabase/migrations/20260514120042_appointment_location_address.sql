-- The next-appointment card's calendar export uses a street address as
-- the .ics event LOCATION when the appointment has one (e.g. an in-clinic
-- visit at a specific site).
alter table public.appointments
  add column location_address text;

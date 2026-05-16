-- Adds a service-areas / location tagline to the clinic profile. Surfaced
-- on the patient Contact hero before the opening-hours summary, e.g.
-- "Brisbane & Gold Coast · Mon–Fri 8AM–5PM · Sat 9AM–1PM".
--
-- TODO: expose service_areas in the Settings → Clinic & Staff editor
-- alongside name / address / phone. Until that lands, staff change it via
-- Supabase Studio.

alter table public.clinic_profile
  add column if not exists service_areas text;

-- Backfill the existing (seeded) Focus Vision row so it has a sensible
-- default. A fresh DB reset replays the migration 035 insert (no
-- service_areas) and then this backfill, so resets stay consistent too.
update public.clinic_profile
  set service_areas = 'Brisbane & Gold Coast'
  where service_areas is null;

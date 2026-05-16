-- Links a procedure to the day hospital where it was performed. Nullable:
-- existing procedures and clinic-only procedures have no facility. Surfaced
-- on the patient Feedback screen's "Day Hospital" blurb.
alter table public.procedures
  add column facility_id uuid references public.partner_facilities(id)
    on delete set null;

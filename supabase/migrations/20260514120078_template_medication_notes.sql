-- General medication notes for a procedure template — clinic guidance
-- that applies to all of that template's medications (e.g. "leave 5
-- minutes between different drops"). Shown to the patient on their
-- medications screen.
alter table public.procedure_templates
  add column medication_notes text;

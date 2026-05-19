-- Let a patient read the procedure template their own procedure was
-- created from. Needed so the patient medications screen can show that
-- template's general medication notes. Scoped to their own template
-- only — staff policies are unchanged (RLS policies are OR-ed).
create policy procedure_templates_patient_read on public.procedure_templates
  for select to authenticated
  using (
    exists (
      select 1 from public.procedures p
      where p.source_template_id = procedure_templates.id
        and p.patient_id = auth.uid()
    )
  );

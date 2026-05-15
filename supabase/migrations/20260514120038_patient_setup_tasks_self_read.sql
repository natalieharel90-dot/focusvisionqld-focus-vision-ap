-- The onboarding tour gate (spec §5.1) checks PatientSetupTask.status from
-- the patient app, but patient_setup_tasks was staff-only — a patient
-- could not read their own row, so shouldShowOnboarding always saw an
-- undefined status and the tour never fired. Allow a patient to read
-- (only) their own setup task. Writes stay staff-only.
create policy patient_setup_tasks_self_select on public.patient_setup_tasks
  for select using (patient_id = auth.uid());

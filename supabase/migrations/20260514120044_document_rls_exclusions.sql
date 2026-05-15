-- Silent-RLS audit follow-up. Every patient-owned table that a patient
-- *should* read already has a patient-self SELECT policy. Five staff-only
-- tables carry a patient_id but are deliberately NOT patient-readable.
-- This migration records those decisions as comments on the policies, so
-- the exclusion is explicit at the schema level — a future "add a
-- patient-self policy" change would then be a conscious one.
--
-- No functional change: comments only.

comment on policy staff_notes_select on public.staff_notes is
  'Staff-only by design — internal staff notes are never visible to the patient (spec section 7, StaffNote).';

comment on policy manual_flags_staff_all on public.manual_flags is
  'Staff-only by design — patients never see manual flags or Red alerts (spec section 6.7: patients never see Red).';

comment on policy audit_events_select on public.audit_events is
  'Staff-only by design — the audit log is an admin/compliance surface (Australian Privacy Principle 11); patients never read it.';

comment on policy bulk_pushes_staff_select on public.bulk_pushes is
  'Staff-only by design — patients never see bulk-push records or who else was in a cohort (spec section 6.12).';

comment on policy bulk_push_deliveries_staff_select on public.bulk_push_deliveries is
  'Staff-only by design — the patient sees the delivered message via messages RLS, never the delivery / cohort row.';

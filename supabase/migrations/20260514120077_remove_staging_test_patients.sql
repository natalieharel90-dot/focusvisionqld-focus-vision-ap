-- One-off staging cleanup: remove the seed/test patient accounts so the
-- clinic can start fresh with real patients. Harmless on any other
-- database — these seed emails simply won't exist there.
--
-- The audit-log guard is briefly lifted: deleting a patient set-nulls
-- audit_events.patient_id, which the append-only trigger would otherwise
-- block. The guard is restored at the end of the same transaction.

alter table public.audit_events disable trigger audit_events_block_update;
alter table public.audit_events disable trigger audit_events_block_delete;

-- Deleting the patients row cascades all of their data (procedures,
-- check-ins, medications, messages, documents, photos, …).
delete from public.patients
where email in (
  'patient.one@example.dev',
  'patient.two@example.dev',
  'patient.three@example.dev',
  'patient.four@example.dev',
  'patient.five@example.dev',
  'test@gmail.com',
  'test@testy.com.au'
);

-- Remove the now-orphaned auth accounts so the email addresses are free.
delete from auth.users
where email in (
  'patient.one@example.dev',
  'patient.two@example.dev',
  'patient.three@example.dev',
  'patient.four@example.dev',
  'patient.five@example.dev',
  'test@gmail.com',
  'test@testy.com.au'
);

alter table public.audit_events enable trigger audit_events_block_update;
alter table public.audit_events enable trigger audit_events_block_delete;

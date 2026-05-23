-- Force new patients to replace the clinic-issued temporary password
-- (FocusVisionRecovery) on their first sign-in. password_set defaults
-- to false on new patients and is flipped to true the first time the
-- patient updates their own password.
--
-- Existing patients are bulk-marked true so they aren't kicked back to
-- the password screen on next sign-in — only freshly-created patients
-- go through the forced flow.

alter table public.patients
  add column password_set boolean not null default false;

update public.patients set password_set = true;

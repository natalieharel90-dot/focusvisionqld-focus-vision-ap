-- The staff-mention field on patient feedback is a free-text field per
-- spec §5.9 ("e.g. Dr Chen, Receptionist Hannah, Nurse Mark"), not a
-- staff_users reference. No feedback rows exist yet, so dropping the
-- column is safe.
alter table public.feedback drop column staff_mention_id;
alter table public.feedback add column staff_mention text;

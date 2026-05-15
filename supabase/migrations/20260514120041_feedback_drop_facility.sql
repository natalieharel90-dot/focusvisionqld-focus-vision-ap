-- The clinic uses a single partner hospital, so hospital feedback no
-- longer picks a facility — it uses the same free-text staff_mention
-- field as clinic feedback. Drop the now-unused facility reference and
-- the partner_facilities table.
alter table public.feedback drop column facility_id;
drop table public.partner_facilities;

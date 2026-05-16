-- Fold the doctors roster into staff_users — step 3 of 3 (final).
--
-- Run only after scripts/unify-doctors.ts has completed: every doctors
-- row has been merged into, or recreated as, a staff_users row. The
-- doctor-photos and doctor-videos storage buckets are intentionally kept
-- — staff_users.photo_url / welcome_video_url still point at them.
drop table if exists public.doctors;

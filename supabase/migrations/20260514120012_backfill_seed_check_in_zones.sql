-- Backfill the seed check_ins so their stored zones match what the
-- routing engine (lib/zones.ts) computes against the default ruleset
-- introduced in migration 11. Targets only the well-known seed patient
-- UUIDs (a0000001..a0000005), so this is a no-op in any environment that
-- doesn't have the seed data loaded (e.g. production). Idempotent.

-- Patient Two, Day 1: pain 3 + light 4 → escalates from yellow to orange.
update public.check_ins
   set patient_zone = 'orange',
       staff_alert_level = 'orange'
 where patient_id = 'a0000002-0000-0000-0000-000000000002'
   and recovery_day = 1;

-- Patient Two, Day 3: pain 2 yellow combined with light 2 (off) gives
-- yellow, not green.
update public.check_ins
   set patient_zone = 'yellow',
       staff_alert_level = 'yellow'
 where patient_id = 'a0000002-0000-0000-0000-000000000002'
   and recovery_day = 3;

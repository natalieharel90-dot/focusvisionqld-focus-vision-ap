-- Practice analytics: pre-aggregated materialized views + a refresh
-- function. Every view contains aggregates only — no patient_id, no
-- names, no free text — so exposing them carries no PII risk.

-- ── Check-in aggregates: day × procedure × surgeon × zone × alert ────────
create materialized view public.mv_analytics_check_in_daily as
select
  (c.created_at at time zone 'Australia/Brisbane')::date as day,
  coalesce(pr.procedure_type, 'unknown') as procedure_type,
  pr.surgeon_id,
  c.patient_zone,
  c.staff_alert_level,
  count(*)::bigint as check_in_count
from public.check_ins c
left join lateral (
  select p.procedure_type, p.surgeon_id
  from public.procedures p
  where p.patient_id = c.patient_id and p.status = 'active'
  order by p.surgery_date desc
  limit 1
) pr on true
group by 1, 2, 3, 4, 5;

-- ── Dose aggregates: day × surgeon → scheduled vs taken ──────────────────
create materialized view public.mv_analytics_dose_daily as
select
  (d.scheduled_at at time zone 'Australia/Brisbane')::date as day,
  pr.surgeon_id,
  count(*)::bigint as scheduled_count,
  count(d.taken_at)::bigint as taken_count
from public.medication_doses d
join public.medications m on m.id = d.medication_id
left join lateral (
  select p.surgeon_id
  from public.procedures p
  where p.patient_id = m.patient_id and p.status = 'active'
  order by p.surgery_date desc
  limit 1
) pr on true
group by 1, 2;

-- ── Completion by recovery day: expected vs submitted check-ins ──────────
-- Recovery-day profile across all patients (not date-range sliceable).
create materialized view public.mv_analytics_checkin_completion as
with patient_day as (
  select
    p.id as patient_id,
    greatest(0, least(90, (current_date - pr.surgery_date)))::int
      as max_recovery_day
  from public.patients p
  join lateral (
    select pp.surgery_date
    from public.procedures pp
    where pp.patient_id = p.id and pp.status = 'active'
    order by pp.surgery_date desc
    limit 1
  ) pr on true
),
expected as (
  select gs.recovery_day, count(*)::bigint as expected_count
  from patient_day pd
  cross join lateral generate_series(1, pd.max_recovery_day)
    as gs(recovery_day)
  group by 1
),
submitted as (
  select recovery_day, count(*)::bigint as submitted_count
  from public.check_ins
  where recovery_day between 1 and 90
  group by 1
)
select
  e.recovery_day,
  e.expected_count,
  coalesce(s.submitted_count, 0)::bigint as submitted_count
from expected e
left join submitted s on s.recovery_day = e.recovery_day;

-- ── Symptom frequency: day × symptom → occurrences ───────────────────────
create materialized view public.mv_analytics_symptom_daily as
select
  (c.created_at at time zone 'Australia/Brisbane')::date as day,
  sym.symptom,
  count(*)::bigint as occurrences
from public.check_ins c
cross join lateral unnest(c.unusual_symptoms) as sym(symptom)
group by 1, 2;

-- ── Message response time: one row per patient message ───────────────────
-- response_seconds = gap to the first staff reply after it (NULL if none).
create materialized view public.mv_analytics_message_response as
select
  (m.sent_at at time zone 'Australia/Brisbane')::date as day,
  extract(epoch from (
    (
      select min(s.sent_at)
      from public.messages s
      where s.thread_id = m.thread_id
        and s.sender_type = 'staff'
        and s.sent_at > m.sent_at
    ) - m.sent_at
  ))::bigint as response_seconds
from public.messages m
where m.sender_type = 'patient';

-- ── Onboarding: one row per setup task (for new-patient counts) ──────────
create materialized view public.mv_analytics_onboarding as
select
  (t.created_at at time zone 'Australia/Brisbane')::date as created_day,
  t.status
from public.patient_setup_tasks t;

grant select on
  public.mv_analytics_check_in_daily,
  public.mv_analytics_dose_daily,
  public.mv_analytics_checkin_completion,
  public.mv_analytics_symptom_daily,
  public.mv_analytics_message_response,
  public.mv_analytics_onboarding
to authenticated;

-- ── Refresh function ─────────────────────────────────────────────────────
-- SECURITY DEFINER so authenticated staff can trigger a refresh (the
-- "Refresh data" button) and a nightly scheduled job can call it.
create or replace function public.refresh_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  refresh materialized view public.mv_analytics_check_in_daily;
  refresh materialized view public.mv_analytics_dose_daily;
  refresh materialized view public.mv_analytics_checkin_completion;
  refresh materialized view public.mv_analytics_symptom_daily;
  refresh materialized view public.mv_analytics_message_response;
  refresh materialized view public.mv_analytics_onboarding;
end;
$$;

revoke all on function public.refresh_analytics() from public;
grant execute on function public.refresh_analytics() to authenticated;

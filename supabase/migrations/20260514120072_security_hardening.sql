-- Security hardening — closes RLS / privilege gaps found in the project
-- audit. See the audit report for the rationale behind each block.

-- ── 1. patients: drop the column-blind self-update policy ────────────────
-- The old patients_self_update was column-blind — a patient could rewrite
-- medicare_number, discharged_at, phone_verified, allergies, etc. Patients
-- no longer update `patients` directly; the only legitimate patient write
-- (the verified phone number) now goes through confirm_phone_verification.
drop policy if exists patients_self_update on public.patients;

-- ── 2. medication_doses: add the missing WITH CHECK ──────────────────────
-- Without WITH CHECK a patient could UPDATE one of their dose rows and
-- re-point medication_id at another patient's medication.
drop policy if exists medication_doses_patient_update
  on public.medication_doses;
create policy medication_doses_patient_update on public.medication_doses
  for update
  using (
    exists (
      select 1 from public.medications m
      where m.id = medication_doses.medication_id
        and m.patient_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.medications m
      where m.id = medication_doses.medication_id
        and m.patient_id = auth.uid()
    )
  );

-- ── 3. patient_phone_verifications: patients can't self-verify ───────────
-- The old FOR ALL policy let a patient INSERT a row with verified_at
-- already set, or UPDATE one to mark it verified. Patients may now only
-- read their own rows and create / discard *unverified* ones. The actual
-- verification runs in confirm_phone_verification (SECURITY DEFINER).
drop policy if exists patient_phone_verifications_self
  on public.patient_phone_verifications;
create policy patient_phone_verifications_select
  on public.patient_phone_verifications
  for select using (patient_id = auth.uid());
create policy patient_phone_verifications_insert
  on public.patient_phone_verifications
  for insert with check (patient_id = auth.uid() and verified_at is null);
create policy patient_phone_verifications_delete
  on public.patient_phone_verifications
  for delete using (patient_id = auth.uid() and verified_at is null);

-- Checks a submitted code hash against the patient's latest pending
-- verification. On a match it marks the row verified and writes the
-- verified number onto the patient. Runs as definer so the patient needs
-- no UPDATE privilege on either table.
-- Returns one of: 'ok' | 'wrong' | 'expired' | 'locked' | 'none'.
create or replace function public.confirm_phone_verification(
  p_code_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.patient_phone_verifications;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row
  from public.patient_phone_verifications
  where patient_id = v_uid and verified_at is null
  order by created_at desc
  limit 1;

  if v_row.id is null then
    return 'none';
  end if;
  if v_row.expires_at < now() then
    delete from public.patient_phone_verifications where id = v_row.id;
    return 'expired';
  end if;
  if v_row.attempts >= 5 then
    delete from public.patient_phone_verifications where id = v_row.id;
    return 'locked';
  end if;
  if v_row.code_hash <> p_code_hash then
    update public.patient_phone_verifications
      set attempts = attempts + 1
      where id = v_row.id;
    return 'wrong';
  end if;

  update public.patient_phone_verifications
    set verified_at = now()
    where id = v_row.id;
  update public.patients
    set phone = v_row.phone, phone_verified = true
    where id = v_uid;
  return 'ok';
end;
$$;

revoke all on function public.confirm_phone_verification(text) from public;
grant execute on function public.confirm_phone_verification(text)
  to authenticated;

-- ── 4. send_bulk_push_now: enforce the tier-≤2 restriction ───────────────
-- The function only checked is_staff(); a tier-3 reception user could call
-- it directly and fan a push to the whole patient cohort.
create or replace function public.send_bulk_push_now(p_push_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.staff_users
    where id = auth.uid() and access_tier <= 2
  ) then
    raise exception 'forbidden';
  end if;
  perform public.fire_bulk_push(p_push_id);
end;
$$;

-- ── 5. Analytics: stop materialized views leaking to every patient ───────
-- Materialized views don't honour RLS and SELECT was granted to all
-- authenticated users, so patients (and reception) could query
-- clinic-wide analytics directly. Wrap each MV in a view guarded by an
-- analytics-tier check and revoke direct access to the MVs.
create or replace function public.can_view_analytics()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_users
    where id = auth.uid()
      and (access_tier = 1 or role = 'surgeon')
  );
$$;

create or replace view public.analytics_check_in_daily as
  select * from public.mv_analytics_check_in_daily
  where public.can_view_analytics();
create or replace view public.analytics_dose_daily as
  select * from public.mv_analytics_dose_daily
  where public.can_view_analytics();
create or replace view public.analytics_checkin_completion as
  select * from public.mv_analytics_checkin_completion
  where public.can_view_analytics();
create or replace view public.analytics_symptom_daily as
  select * from public.mv_analytics_symptom_daily
  where public.can_view_analytics();
create or replace view public.analytics_message_response as
  select * from public.mv_analytics_message_response
  where public.can_view_analytics();
create or replace view public.analytics_onboarding as
  select * from public.mv_analytics_onboarding
  where public.can_view_analytics();

revoke select on
  public.mv_analytics_check_in_daily,
  public.mv_analytics_dose_daily,
  public.mv_analytics_checkin_completion,
  public.mv_analytics_symptom_daily,
  public.mv_analytics_message_response,
  public.mv_analytics_onboarding
from authenticated;

grant select on
  public.analytics_check_in_daily,
  public.analytics_dose_daily,
  public.analytics_checkin_completion,
  public.analytics_symptom_daily,
  public.analytics_message_response,
  public.analytics_onboarding
to authenticated;

-- Row Level Security: patients see only their own data; staff see all.
-- audit_events and staff_notes are read-by-staff-only and append-only at
-- the policy level (privileges revoked separately in the previous migration).

-- Helper: is the current auth user a staff member?
-- SECURITY DEFINER so it bypasses RLS on staff_users (otherwise the
-- staff_users SELECT policy would recurse via this function).
-- search_path is pinned to public to prevent shadowing of staff_users.
create or replace function public.is_staff()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (select 1 from public.staff_users where id = auth.uid());
end;
$$;

-- Enable RLS on every public table.
alter table public.staff_users enable row level security;
alter table public.procedure_templates enable row level security;
alter table public.procedures enable row level security;
alter table public.patients enable row level security;
alter table public.medications enable row level security;
alter table public.medication_doses enable row level security;
alter table public.check_ins enable row level security;
alter table public.appointments enable row level security;
alter table public.documents enable row level security;
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.routing_rulesets enable row level security;
alter table public.routing_rules enable row level security;
alter table public.zone_content enable row level security;
alter table public.staff_notes enable row level security;
alter table public.manual_flags enable row level security;
alter table public.audit_events enable row level security;

-- staff_users: a staff user can see their own row; staff can see all staff.
create policy staff_users_self_select on public.staff_users
  for select using (id = auth.uid() or public.is_staff());
create policy staff_users_staff_write on public.staff_users
  for all using (public.is_staff()) with check (public.is_staff());

-- patients: a patient sees their own row; staff see all.
create policy patients_select on public.patients
  for select using (id = auth.uid() or public.is_staff());
create policy patients_self_update on public.patients
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy patients_staff_write on public.patients
  for all using (public.is_staff()) with check (public.is_staff());

-- procedure_templates: staff-only (configured in dashboard Procedures lib).
create policy procedure_templates_staff_all on public.procedure_templates
  for all using (public.is_staff()) with check (public.is_staff());

-- procedures: patient sees own; staff see all.
create policy procedures_select on public.procedures
  for select using (patient_id = auth.uid() or public.is_staff());
create policy procedures_staff_write on public.procedures
  for all using (public.is_staff()) with check (public.is_staff());

-- medications: patient sees own (active rows filtered in app, not RLS);
-- staff manage all.
create policy medications_select on public.medications
  for select using (patient_id = auth.uid() or public.is_staff());
create policy medications_staff_write on public.medications
  for all using (public.is_staff()) with check (public.is_staff());

-- medication_doses: patient sees own (joined via medication); marking a
-- dose taken is a patient-initiated write so allow patient UPDATE.
create policy medication_doses_select on public.medication_doses
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.medications m
      where m.id = medication_doses.medication_id
        and m.patient_id = auth.uid()
    )
  );
create policy medication_doses_patient_update on public.medication_doses
  for update using (
    exists (
      select 1 from public.medications m
      where m.id = medication_doses.medication_id
        and m.patient_id = auth.uid()
    )
  );
create policy medication_doses_staff_write on public.medication_doses
  for all using (public.is_staff()) with check (public.is_staff());

-- check_ins: patient writes their own (submits), staff read all + review.
create policy check_ins_select on public.check_ins
  for select using (patient_id = auth.uid() or public.is_staff());
create policy check_ins_patient_insert on public.check_ins
  for insert with check (patient_id = auth.uid());
create policy check_ins_staff_write on public.check_ins
  for all using (public.is_staff()) with check (public.is_staff());

-- appointments: patient sees own; staff manage all.
create policy appointments_select on public.appointments
  for select using (patient_id = auth.uid() or public.is_staff());
create policy appointments_patient_update on public.appointments
  for update using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy appointments_staff_write on public.appointments
  for all using (public.is_staff()) with check (public.is_staff());

-- documents: patient sees own; staff manage all.
create policy documents_select on public.documents
  for select using (patient_id = auth.uid() or public.is_staff());
create policy documents_staff_write on public.documents
  for all using (public.is_staff()) with check (public.is_staff());

-- message_threads: patient sees own; staff see all.
create policy message_threads_select on public.message_threads
  for select using (patient_id = auth.uid() or public.is_staff());
create policy message_threads_staff_write on public.message_threads
  for all using (public.is_staff()) with check (public.is_staff());

-- messages: visible if you can see the parent thread.
create policy messages_select on public.messages
  for select using (
    exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id
        and (t.patient_id = auth.uid() or public.is_staff())
    )
  );
create policy messages_patient_insert on public.messages
  for insert with check (
    sender_type = 'patient'
    and sender_id = auth.uid()
    and exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id and t.patient_id = auth.uid()
    )
  );
create policy messages_staff_insert on public.messages
  for insert with check (
    public.is_staff() and sender_type = 'staff' and sender_id = auth.uid()
  );

-- routing_rulesets / routing_rules / zone_content: staff-only.
create policy routing_rulesets_staff_all on public.routing_rulesets
  for all using (public.is_staff()) with check (public.is_staff());
create policy routing_rules_staff_all on public.routing_rules
  for all using (public.is_staff()) with check (public.is_staff());
create policy zone_content_staff_all on public.zone_content
  for all using (public.is_staff()) with check (public.is_staff());

-- staff_notes: staff-only, append-only (UPDATE/DELETE privileges revoked
-- in the previous migration; we just expose SELECT + INSERT here).
create policy staff_notes_select on public.staff_notes
  for select using (public.is_staff());
create policy staff_notes_insert on public.staff_notes
  for insert with check (public.is_staff() and author_staff_id = auth.uid());

-- manual_flags: staff-only.
create policy manual_flags_staff_all on public.manual_flags
  for all using (public.is_staff()) with check (public.is_staff());

-- audit_events: staff can SELECT and INSERT only.
-- UPDATE/DELETE privileges are revoked in the previous migration; no
-- policies are defined for those operations.
create policy audit_events_select on public.audit_events
  for select using (public.is_staff());
create policy audit_events_insert on public.audit_events
  for insert with check (public.is_staff() and actor_staff_id = auth.uid());

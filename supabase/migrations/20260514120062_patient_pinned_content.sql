-- Custom content pinned to a patient's app home screen by staff — a
-- recovery-guidance video/document or a one-off reassurance message.
create table public.patient_pinned_content (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('content', 'document', 'message')),
  label text not null,
  created_by_staff_id uuid references public.staff_users(id),
  created_at timestamptz not null default now()
);

create index patient_pinned_content_patient_idx
  on public.patient_pinned_content (patient_id);

alter table public.patient_pinned_content enable row level security;

create policy patient_pinned_content_select on public.patient_pinned_content
  for select using (patient_id = auth.uid() or public.is_staff());
create policy patient_pinned_content_staff_write on public.patient_pinned_content
  for all using (public.is_staff()) with check (public.is_staff());

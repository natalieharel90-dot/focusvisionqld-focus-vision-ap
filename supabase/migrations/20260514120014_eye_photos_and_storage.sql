-- Eye photos (spec section 7 EyePhoto entity) + Supabase Storage bucket
-- for the binary files. Photos are linked to the patient and the
-- check-in that captured them (nullable in case a check-in is deleted).

create table public.eye_photos (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  check_in_id uuid references public.check_ins(id) on delete set null,
  storage_path text not null,
  recovery_day integer,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.eye_photos
for each row execute function public.set_updated_at();

create index eye_photos_patient_idx on public.eye_photos (patient_id);
create index eye_photos_check_in_idx on public.eye_photos (check_in_id)
  where check_in_id is not null;

alter table public.eye_photos enable row level security;

create policy eye_photos_select on public.eye_photos
  for select using (patient_id = auth.uid() or public.is_staff());
create policy eye_photos_patient_insert on public.eye_photos
  for insert with check (patient_id = auth.uid());
create policy eye_photos_staff_write on public.eye_photos
  for all using (public.is_staff()) with check (public.is_staff());

-- ── Storage bucket ──
-- patient-photos is private (public=false). Signed URLs are issued on
-- read; uploads are RLS-controlled by path prefix.

insert into storage.buckets (id, name, public)
values ('patient-photos', 'patient-photos', false)
on conflict (id) do nothing;

-- Path convention: <patient_uuid>/<filename>. Storage's RLS only sees the
-- object path, so we encode ownership in the first folder segment.

create policy "patient_upload_own_photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'patient-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "patient_read_own_photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'patient-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff_read_all_patient_photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'patient-photos'
    and public.is_staff()
  );

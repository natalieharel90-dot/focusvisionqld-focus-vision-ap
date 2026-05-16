-- A doctor can record an optional welcome video, shown to their patients
-- in the patient app. Stored in a public bucket so welcome_video_url is a
-- plain public URL; staff upload only.

alter table public.doctors add column welcome_video_url text;

insert into storage.buckets (id, name, public)
values ('doctor-videos', 'doctor-videos', true)
on conflict (id) do nothing;

create policy "staff_upload_doctor_videos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'doctor-videos' and public.is_staff());
create policy "staff_update_doctor_videos" on storage.objects
  for update to authenticated
  using (bucket_id = 'doctor-videos' and public.is_staff());

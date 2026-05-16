-- The display label for the after-hours emergency notice shown at the
-- foot of the patient's Contact screen, editable in Settings.
alter table public.clinic_profile
  add column after_hours_label text not null default 'After hours emergency';

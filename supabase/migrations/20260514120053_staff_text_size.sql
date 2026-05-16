-- Per-staff dashboard text size, set from Settings → Appearance.
alter table public.staff_users
  add column text_size text not null default 'normal'
  check (text_size in ('small', 'normal', 'large'));

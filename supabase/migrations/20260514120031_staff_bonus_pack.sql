-- Extend the hidden bonus theme pack to the staff dashboard. Staff
-- unlock it via the dashboard logo Easter egg, exactly like patients.
-- Mirrors the patient-side columns on user_preferences.

alter table public.staff_users
  drop constraint staff_users_theme_check;

alter table public.staff_users
  add constraint staff_users_theme_check check (
    theme in (
      'calm', 'premium', 'bright', 'terracotta', 'minimal',
      'roots', 'gilded', 'twilight', 'scarlet', 'skyline', 'eclipse',
      'bloom', 'mist', 'ember', 'midnight', 'inkwell', 'limelight',
      'random'
    )
  );

alter table public.staff_users
  add column bonus_pack_unlocked boolean not null default false,
  add column sparkle boolean not null default false;

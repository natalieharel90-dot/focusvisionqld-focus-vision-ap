-- De-brand the hidden theme pack: neutral theme ids + a neutral unlock
-- column name. Palettes are unchanged — only identifiers.

alter table public.user_preferences
  rename column ts_pack_unlocked to bonus_pack_unlocked;

alter table public.user_preferences
  drop constraint user_preferences_theme_check;

alter table public.user_preferences
  add constraint user_preferences_theme_check check (
    theme in (
      'calm', 'premium', 'bright', 'terracotta', 'minimal',
      'roots', 'gilded', 'twilight', 'scarlet', 'skyline', 'eclipse',
      'bloom', 'mist', 'ember', 'midnight', 'inkwell', 'limelight',
      'random'
    )
  );

-- Hidden "TS theme pack" — twelve extra era themes for the patient app,
-- unlocked per patient via an Easter egg. Staff themes are unaffected.

-- Expand the allowed theme set with the twelve eras + the 'random'
-- meta-option. (Visible themes: calm/premium/bright/terracotta/minimal.)
alter table public.user_preferences
  drop constraint user_preferences_theme_check;

alter table public.user_preferences
  add constraint user_preferences_theme_check check (
    theme in (
      'calm', 'premium', 'bright', 'terracotta', 'minimal',
      'debut', 'fearless', 'speaknow', 'red', 'nineteen89',
      'reputation', 'lover', 'folklore', 'evermore', 'midnights',
      'ttpd', 'showgirl', 'random'
    )
  );

-- Unlock state (persists once true — no re-lock) + sparkle overlay flag.
alter table public.user_preferences
  add column ts_pack_unlocked boolean not null default false,
  add column sparkle boolean not null default false;

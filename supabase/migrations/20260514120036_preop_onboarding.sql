-- Patient Pre-op information screen (spec §5.10) + Onboarding tour (§5.1).
--   - content_items: minimal clinic content library
--   - procedure_templates.surgery_day_text: editable "what to expect on
--     surgery day" copy, with most-specific-wins fallback
--   - user_preferences.onboarding_completed_at: gates the first-run tour

-- ── onboarding gate ──────────────────────────────────────────────────────
alter table public.user_preferences
  add column onboarding_completed_at timestamptz;

-- ── surgery-day text ─────────────────────────────────────────────────────
-- Per (surgeon × procedure) template. The pre-op screen falls back:
-- the patient's own template → any template for the procedure → a
-- clinic-wide default baked into the app.
alter table public.procedure_templates
  add column surgery_day_text text;

-- ── content_items ────────────────────────────────────────────────────────
-- Minimal content library. procedures = the procedure types an item is
-- relevant to (empty = all). audience gates pre-op vs post-op surfacing.
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('video', 'article')),
  title text not null,
  body text,
  media_url text,
  procedures text[] not null default '{}',
  days_range int4range,
  topics text[] not null default '{}',
  audience text not null default 'both'
    check (audience in ('pre_op', 'post_op', 'both')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.content_items
for each row execute function public.set_updated_at();

alter table public.content_items enable row level security;

create policy content_items_select on public.content_items
  for select using (auth.uid() is not null);
create policy content_items_staff_write on public.content_items
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.content_items
  (type, title, body, media_url, procedures, days_range, topics, audience)
values
  ('article', 'Preparing for your procedure',
   'A short guide to the days leading up to surgery — what to organise and what to expect.',
   null, '{}', null, '{preparation}', 'pre_op'),
  ('video', 'A welcome from the Focus Vision team',
   'Meet the team and see the clinic before your visit.',
   'https://videos.focusvision.example/welcome', '{}', null, '{welcome}', 'pre_op'),
  ('article', 'Managing pre-surgery nerves',
   'Feeling anxious before eye surgery is completely normal. Here is what helps.',
   null, '{}', null, '{wellbeing}', 'both'),
  ('article', 'LASIK: the day before',
   'LASIK-specific preparation — stopping contact lenses, avoiding eye makeup, and more.',
   null, '{lasik}', null, '{preparation}', 'pre_op'),
  ('video', 'What LASIK surgery looks like',
   'A calm, step-by-step walkthrough of the LASIK procedure itself.',
   'https://videos.focusvision.example/lasik-walkthrough', '{lasik}', null,
   '{procedure}', 'pre_op'),
  ('video', 'Halos and glare at night — what is normal',
   'Many patients notice halos around lights for a few weeks. Here is why.',
   'https://videos.focusvision.example/halos', '{lasik,prk}', '[3,14)',
   '{symptoms}', 'post_op'),
  ('article', 'Driving and screen time after surgery',
   'When it is safe to get back behind the wheel and back to your devices.',
   null, '{}', '[5,30)', '{lifestyle}', 'post_op');

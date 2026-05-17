-- Adds a dedicated 'faq' content type. FAQ items surface as the
-- "Common questions" section on the patient Pre-op screen.
alter table public.content_items
  drop constraint content_items_type_check;
alter table public.content_items
  add constraint content_items_type_check
    check (type in ('video', 'article', 'faq'));

-- Seed the standard LASIK pre-op common questions.
insert into public.content_items (type, title, body, procedures, audience)
values
  ('faq', 'Will the surgery hurt?',
   'Most patients feel only pressure during the procedure, not pain. '
   || 'Numbing drops keep the eye comfortable throughout.',
   '{lasik}', 'pre_op'),
  ('faq', 'How long does the procedure take?',
   'Typically 15–30 minutes in total. It uses drops only — there are no '
   || 'needles.',
   '{lasik}', 'pre_op'),
  ('faq', 'When will I see clearly?',
   'Most patients see well within 24 hours. Vision continues to settle '
   || 'over the following 2–4 weeks.',
   '{lasik}', 'pre_op');

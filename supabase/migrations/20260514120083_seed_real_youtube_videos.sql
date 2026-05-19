-- Real Focus Vision YouTube videos as content_items. Pre-op videos
-- surface automatically on the patient pre-op screen (filtered by
-- audience + procedure). Post-op videos sit in the staff content
-- library so they can be pushed to individual patients with their
-- post-op pack (per the clinic's workflow).
--
-- Idempotent: deletes any existing rows with the same YouTube URLs
-- before inserting, so re-running refreshes cleanly.

delete from public.content_items
  where type = 'video'
    and media_url in (
      'https://youtu.be/6ee7DIqFi4k',
      'https://youtu.be/v3MMS4JPB54',
      'https://youtu.be/78DV3MkaeFM',
      'https://youtu.be/MjOu160HE4g',
      'https://youtu.be/bFm29W47E00',
      'https://youtu.be/4TmKuMtdv_M',
      'https://youtu.be/Wv1vPBPC3ak',
      'https://youtu.be/LXkqn4UtBdM',
      'https://youtu.be/IaKcNPKinx0',
      'https://youtu.be/WPaG5Gb2zIc',
      'https://youtu.be/2c5STVkxeM4',
      'https://youtu.be/Y7pS6LmJrO4',
      'https://youtu.be/sATYyqabRiw',
      'https://youtu.be/NMjZbAOTFWY',
      'https://youtu.be/fvENwzPP15Q',
      'https://youtu.be/kgNvsPynKyw',
      'https://youtu.be/blWZ78Q0H0c'
    );

insert into public.content_items
  (type, title, body, media_url, procedures, topics, audience)
values

-- ─── General (before first appointment) ────────────────────────────────
('video', 'Before your first appointment',
 'A short introduction to watch before your optometry assessment — what to expect and what to bring.',
 'https://youtu.be/6ee7DIqFi4k',
 array[]::text[], array['intro'], 'pre_op'),

-- ─── Lens surgery (RLE + Cataract) ─────────────────────────────────────
('video', 'About lens surgery',
 'An overview of how refractive lens exchange and cataract surgery work, and the lens options available.',
 'https://youtu.be/v3MMS4JPB54',
 array['rle','cataract'], array['intro'], 'pre_op'),

('video', 'Lens surgery — consent',
 'Walks through the risks and what you''re consenting to before lens surgery. Please watch before your pre-op consultation.',
 'https://youtu.be/78DV3MkaeFM',
 array['rle','cataract'], array['consent'], 'pre_op'),

('video', 'Lens surgery — recovery',
 'What to expect in the days and weeks after your lens surgery.',
 'https://youtu.be/MjOu160HE4g',
 array['rle','cataract'], array['recovery'], 'post_op'),

('video', '1 month post lens surgery',
 'What to expect around the 1-month mark — dry eye, glasses changes, and how vision settles.',
 'https://youtu.be/bFm29W47E00',
 array['rle','cataract'], array['review_1month'], 'post_op'),

-- ─── Laser (LASIK, PRK, CLEAR) ─────────────────────────────────────────
('video', 'About laser eye surgery',
 'An overview of the laser options (LASIK, PRK, CLEAR) and how each one works.',
 'https://youtu.be/4TmKuMtdv_M',
 array['lasik','prk','clear'], array['intro'], 'pre_op'),

('video', 'LASIK and CLEAR — consent',
 'Walks through the risks and what you''re consenting to before LASIK or CLEAR. Please watch before your pre-op consultation.',
 'https://youtu.be/Wv1vPBPC3ak',
 array['lasik','clear'], array['consent'], 'pre_op'),

('video', 'PRK — consent',
 'Walks through the risks and what you''re consenting to before PRK. Please watch before your pre-op consultation.',
 'https://youtu.be/LXkqn4UtBdM',
 array['prk'], array['consent'], 'pre_op'),

('video', 'LASIK and CLEAR — recovery',
 'What to expect in the first days and weeks after LASIK or CLEAR.',
 'https://youtu.be/IaKcNPKinx0',
 array['lasik','clear'], array['recovery'], 'post_op'),

('video', 'PRK — recovery',
 'What to expect in the first week after PRK — including the day 3–4 pain dip.',
 'https://youtu.be/WPaG5Gb2zIc',
 array['prk'], array['recovery'], 'post_op'),

('video', 'LASIK — 1 week review',
 'Watch before your 1-week LASIK review — what we''ll check and what to expect.',
 'https://youtu.be/2c5STVkxeM4',
 array['lasik'], array['review_1week'], 'post_op'),

('video', 'CLEAR — 1 week review',
 'Watch before your 1-week CLEAR review — what we''ll check and what to expect.',
 'https://youtu.be/Y7pS6LmJrO4',
 array['clear'], array['review_1week'], 'post_op'),

('video', 'PRK — 1 week review',
 'Watch before your 1-week PRK review — what we''ll check and what to expect.',
 'https://youtu.be/sATYyqabRiw',
 array['prk'], array['review_1week'], 'post_op'),

-- ─── ICL ───────────────────────────────────────────────────────────────
('video', 'ICL surgery — explained and consent',
 'How ICL works and the risks you''re consenting to. All ICL candidates should watch this before their pre-op consultation.',
 'https://youtu.be/NMjZbAOTFWY',
 array['icl'], array['intro','consent'], 'pre_op'),

('video', 'ICL — recovery',
 'What to expect in the days and weeks after your ICL surgery.',
 'https://youtu.be/fvENwzPP15Q',
 array['icl'], array['recovery'], 'post_op'),

('video', 'ICL — 1 week review',
 'Watch before your 1-week ICL review — what we''ll check and what to expect.',
 'https://youtu.be/kgNvsPynKyw',
 array['icl'], array['review_1week'], 'post_op'),

-- ─── Pterygium ─────────────────────────────────────────────────────────
('video', 'Pterygium — recovery',
 'What to expect after pterygium surgery — including why the eye stays red for several weeks.',
 'https://youtu.be/blWZ78Q0H0c',
 array['pterygium'], array['recovery'], 'post_op');

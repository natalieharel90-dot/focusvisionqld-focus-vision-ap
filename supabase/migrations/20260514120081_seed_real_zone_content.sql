-- Seed procedure-specific recovery guidance into zone_content, one row
-- per (zone × procedure) for the seven procedures the clinic performs.
-- surgeon_id is NULL because both surgeons follow the same protocols —
-- a surgeon-specific row can still override individual fields later.
--
-- Per-field inheritance means each row only sets the fields that differ
-- from the global default — leaving the others NULL lets them inherit.
--
-- Idempotent: ON CONFLICT updates the row in place.

insert into public.zone_content
  (zone, procedure_type, surgeon_id, headline, message, expected_symptoms, today_tip, instructions, warning)
values

-- ─────────────────────── LASIK ───────────────────────
('green', 'lasik', null,
 null, null,
 array[
   'Mild grittiness or "sand in the eye" feeling',
   'Fluctuating vision through the day (very normal in week one)',
   'Watery or stinging eyes',
   'Slight halos around lights at night',
   'Light sensitivity outdoors',
   'Eyes feeling dry — keep up the artificial tears'
 ],
 'Keep up your drops on schedule and use the artificial tears generously — eyes drying out is the single biggest reason for blurry vision in the first month. No rubbing for 7 days. Sunglasses outdoors are a good reminder not to touch your eyes.',
 null, null),

('yellow', 'lasik', null,
 null, null,
 array[
   'Mild to moderate grittiness or scratching',
   'Light sensitivity in bright environments',
   'Fluctuating vision, especially when tired',
   'Moderate dryness — use drops more often',
   'Halos around lights at night'
 ],
 null,
 'Rest your eyes, take a break from screens, lubricate every 30–60 minutes, wear sunglasses outdoors, and skip the gym today. Don''t worry if vision fluctuates — keep using the drops on schedule.',
 'If pain increases, vision drops noticeably, redness worsens, or you see any discharge, please contact the clinic — don''t wait for tomorrow''s check-in.'),

('orange', 'lasik', null,
 null, null,
 null, null, null,
 'Severe pain, sudden vision loss, or rapidly worsening symptoms — call the clinic during hours on 07 3239 5005, or after hours Dr Cronin 0402 124 524 / Dr Gunn 0408 724 910, or go to your nearest emergency department.'),

-- ─────────────────────── PRK ───────────────────────
('green', 'prk', null,
 null, null,
 array[
   'Eye pain — expected for the first 2–3 days',
   'Very blurred vision — expected for the first week',
   'Significant light sensitivity (sunglasses outdoors are essential)',
   'Eyes watering and gritty',
   'Vision may get WORSE around days 3–4, then improves at day 5 (the surface is healing — normal)',
   'One eye healing differently from the other'
 ],
 'Don''t fixate on differences between your eyes — each one heals at its own pace and almost always evens out. Use the artificial tears as often as you like (some people use them hourly). Keep the sunglasses on whenever you go outside — even briefly, even when cloudy.',
 null, null),

('yellow', 'prk', null,
 null, null,
 array[
   'Eye pain still present (normal up to day 3)',
   'Vision worse than yesterday (often happens days 3–4)',
   'Contact lens feeling uncomfortable',
   'Significant light sensitivity'
 ],
 null,
 'Continue all drops, take the Maxigesic on schedule, use ice packs over closed lids if it helps. Rest with eyes closed — music or audiobooks help pass the time. Sunglasses outdoors are not optional.',
 'If nausea or vomiting starts — stop the Palexia immediately and contact the clinic; the nausea can take 6 hours to settle. If pain is much worse than expected at days 3–4, please call us.'),

('orange', 'prk', null,
 null,
 'What you''re describing can be normal after PRK — very blurred vision and significant discomfort in the first week is expected. Please contact the clinic today so one of our optometrists can check in with you and make sure everything is on track.',
 null, null, null,
 'If pain is uncontrolled despite the Maxigesic and Palexia, if vision drops further after day 5, or if anything feels seriously wrong — call the clinic 07 3239 5005, or after hours Dr Cronin 0402 124 524 / Dr Gunn 0408 724 910, or go to your nearest emergency department.'),

-- ─────────────────────── ICL ───────────────────────
('green', 'icl', null,
 null, null,
 array[
   'Red eye, mild itch, or foreign-body sensation (settles over 8–10 weeks)',
   'Bright lights feel startling — normal with a new artificial lens',
   'One eye seeing more clearly than the other',
   'Vision blurry on Day 0, much clearer by Day 1',
   'Eyelids a little stuck together in the morning'
 ],
 'Use the artificial tears whenever the eye feels scratchy or dry. Wash your hands before each drop. No rubbing the eye for 4 weeks.',
 null, null),

('yellow', 'icl', null,
 null, null,
 array[
   'Mild to moderate irritation or scratchiness',
   'Vision more variable than usual',
   'Dryness — use lubricating drops more often'
 ],
 null,
 'Keep using the prescribed drops. Lubricate generously. Avoid contact sports and swimming. Wear glasses normally if you need them.',
 'If you develop a significant headache in the first 24 hours after surgery, call your surgeon immediately — this is uncommon but important. Otherwise, call the clinic for significant pain or any drop in vision.'),

('orange', 'icl', null,
 null, null,
 null, null, null,
 'Severe headache (especially in the first 24 hours), sudden vision loss, or severe pain — call the clinic 07 3239 5005, after hours Dr Gunn 0408 724 910 / Dr Cronin 0402 124 524, or go to the emergency department.'),

-- ─────────────────────── CLEAR ───────────────────────
('green', 'clear', null,
 null, null,
 array[
   'Eyes scratchy and watering on Day 0 (settles by Day 1)',
   'Vision very blurred on Day 1 — about 70% recovered',
   'Fluctuating vision through the day (dry eyes)',
   'Eyes feeling different from each other',
   'Near vision feeling strained — improves through the first month',
   'Slight halos around lights at night'
 ],
 'Keeping your eyes lubricated speeds healing and improves vision — use the artificial tears more often than you think you need to. Wear the shields overnight for the first week. Avoid rubbing for 7 days.',
 null, null),

('yellow', 'clear', null,
 null, null,
 array[
   'Mild to moderate dryness or grittiness',
   'Vision more fluctuating than yesterday',
   'Eyes feeling tired or strained'
 ],
 null,
 'Rest your eyes, lubricate every 30–60 minutes, skip exercise today, wear sunglasses outdoors. Vision fluctuation is normal — don''t panic if today''s a bit blurrier than yesterday.',
 'Sudden change in vision, severe pain, or vision deteriorating — please call the clinic, don''t wait for tomorrow''s check-in.'),

('orange', 'clear', null,
 null, null,
 null, null, null,
 'Severe symptoms — sudden vision loss, severe unrelenting pain, or rapidly worsening — call the clinic 07 3239 5005, after hours Dr Cronin 0402 124 524 / Dr Gunn 0408 724 910, or go to the emergency department.'),

-- ─────────────────────── CATARACT ───────────────────────
('green', 'cataract', null,
 null, null,
 array[
   'Vision blurred on Day 0, much clearer by Day 1',
   'Flickering light in peripheral vision (very common for the first few weeks)',
   'Bright lights feel startling — normal with a clear artificial lens',
   'Pre-existing floaters more noticeable (settles)',
   'Eyes watering more than usual',
   'Mild redness, dryness, or "tired" feeling — especially around weeks 3–6 when steroid drops finish'
 ],
 'Use your lubricating drops as scheduled. Wash your hands before each drop. Don''t worry if one eye heals faster than the other — each is different. No rubbing the eye for 4 weeks.',
 null, null),

('yellow', 'cataract', null,
 null, null,
 array[
   'Mild to moderate irritation',
   'Vision more variable than the past few days',
   'Eyes feeling dry or tired'
 ],
 null,
 'Keep using all prescribed drops including the lubricants. Take it easy today. If you take other eye drops like glaucoma drops, continue them. One bottle of artificial tears can be used in both eyes.',
 'Significant pain or a drop in vision in the first 2 weeks — please call the clinic.'),

('orange', 'cataract', null,
 null, null,
 null, null, null,
 'Severe pain, sudden vision loss, or fast-worsening symptoms — call the clinic 07 3239 5005, after hours Dr Gunn 0408 724 910 / Dr Cronin 0402 124 524, or go to the emergency department.'),

-- ─────────────────────── RLE (same protocol as cataract) ───────────────────────
('green', 'rle', null,
 null, null,
 array[
   'Vision blurred on Day 0, much clearer by Day 1',
   'Flickering light in peripheral vision (very common for the first few weeks)',
   'Bright lights feel startling — normal with a clear artificial lens',
   'Pre-existing floaters more noticeable (settles)',
   'Eyes watering more than usual',
   'Mild dryness — especially around weeks 3–6 when steroid drops finish'
 ],
 'Use your lubricating drops as scheduled. Wash your hands before each drop. Don''t worry if one eye heals faster than the other — each is different. No rubbing the eye for 4 weeks. If we''re doing one eye at a time, the gap between eyes can feel a bit off-balance — that''s expected.',
 null, null),

('yellow', 'rle', null,
 null, null,
 array[
   'Mild to moderate irritation',
   'Vision more variable than the past few days',
   'Eyes feeling dry or tired'
 ],
 null,
 'Keep using all prescribed drops including the lubricants. Take it easy today. Wait until 5 weeks post-op before getting any new glasses — your prescription is still settling.',
 'Significant pain or a drop in vision in the first 2 weeks — please call the clinic.'),

('orange', 'rle', null,
 null, null,
 null, null, null,
 'Severe pain, sudden vision loss, or fast-worsening symptoms — call the clinic 07 3239 5005, after hours Dr Gunn 0408 724 910 / Dr Cronin 0402 124 524, or go to the emergency department.'),

-- ─────────────────────── PTERYGIUM ───────────────────────
('green', 'pterygium', null,
 null, null,
 array[
   'Eye very red for 3–6 weeks (normal — it will clear)',
   'Mild blood-stained tears for 1–2 days (normal)',
   'Mild double vision for 24 hours (from the local anaesthetic still affecting your eye muscles)',
   'Eye feeling scratchy or watery',
   'Eyelids stuck together in the morning',
   'Some discomfort the night of surgery — take the Maxigesic before bed'
 ],
 'Sun damage causes pterygium — wear a hat and proper wrap-around sunglasses every time you go outside to prevent recurrence. Avoid cheap sunglasses (eBay, markets, overseas) that may not block UV properly. Try to direct one Prednefrin Forte drop up under your upper eyelid each time.',
 null, null),

('yellow', 'pterygium', null,
 null, null,
 array[
   'More pain than expected at night',
   'Eye still very irritated',
   'Vision blurrier than yesterday'
 ],
 null,
 'Keep up your drops. Take it easy. No swimming for 4 weeks. No eye makeup for a week. Sun protection (hat + wrap-around sunglasses) is essential.',
 'Heavy bleeding (more than mild blood-stained tears in the first 1–2 days), extreme pain, or any drop in vision — please call the clinic.'),

('orange', 'pterygium', null,
 null, null,
 null, null, null,
 'Extreme pain or significant vision loss — call the clinic 07 3239 5005, after hours Dr Gunn 0408 724 910 / Dr Cronin 0402 124 524, or go to the emergency department.')

on conflict (zone, procedure_type, surgeon_id) do update set
  headline          = excluded.headline,
  message           = excluded.message,
  expected_symptoms = excluded.expected_symptoms,
  today_tip         = excluded.today_tip,
  instructions      = excluded.instructions,
  warning           = excluded.warning;

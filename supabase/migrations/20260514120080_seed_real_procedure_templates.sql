-- Seed real procedure templates for Focus Vision's two surgeons
-- (Dr David Gunn, Dr Brendan Cronin) across the seven procedures the
-- clinic performs. Content is taken from the clinic's current post-op
-- instruction documents. Idempotent: re-running updates the JSON in
-- place via ON CONFLICT.
--
-- Notes on modelling decisions:
--   • Tapering doses (e.g. CLEAR Pred Forte 6×/day for 7 days then
--     4×/day for 2 weeks) are split into two rows using
--     start_offset_days + duration_days.
--   • "As needed" drops have an empty scheduled_times list so the app
--     doesn't fire reminders for them.
--   • Pterygium drops deliberately start_offset_days = 1 — the
--     instructions say not to start until the day AFTER surgery.
--   • Cataract and RLE share an identical regimen — both seeded.

do $seed$
declare
  gunn_id uuid;
  cronin_id uuid;
begin
  select id into gunn_id
    from public.staff_users
    where role = 'surgeon' and lower(name) like '%gunn%'
    limit 1;
  select id into cronin_id
    from public.staff_users
    where role = 'surgeon' and lower(name) like '%cronin%'
    limit 1;

  if gunn_id is null then raise exception 'Dr Gunn not found in staff_users'; end if;
  if cronin_id is null then raise exception 'Dr Cronin not found in staff_users'; end if;

  -- ── LASIK ────────────────────────────────────────────────────────────
  insert into public.procedure_templates
    (surgeon_id, procedure_type, default_medications, default_appointments, medication_notes)
  values
    (gunn_id, 'lasik',
$$[
  {"name":"Ocuflox","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to 4 times daily from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2"},
  {"name":"Oxybuprocaine","dose":"1 drop","route":"topical eye","frequency":"as needed for pain (first night only)","scheduled_times":[],"duration_days":1,"start_offset_days":0,"taper_notes":"Stings on instillation — only needed for the first night"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":null},
  {"appointment_type":"1 week review","days_after_surgery":7,"location":"in_clinic","notes":null},
  {"appointment_type":"3 month review","days_after_surgery":90,"location":"in_clinic","notes":"Can be arranged with your local optometrist if you live outside Brisbane"}
]$$::jsonb,
     'Start drops 2 hours after surgery. Even if surgery is late in the afternoon, complete the day''s allocation of drops before bed (6× Ocuflox, 4× Prednefrin Forte). Leave 5 minutes between different drops — always use the artificial tears last. Do not rub your eyes for 7 days. Wear the eye shields overnight for the first week.'),
    (cronin_id, 'lasik',
$$[
  {"name":"Ocuflox","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to 4 times daily from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2"},
  {"name":"Oxybuprocaine","dose":"1 drop","route":"topical eye","frequency":"as needed for pain (first night only)","scheduled_times":[],"duration_days":1,"start_offset_days":0,"taper_notes":"Stings on instillation — only needed for the first night"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":null},
  {"appointment_type":"1 week review","days_after_surgery":7,"location":"in_clinic","notes":null},
  {"appointment_type":"3 month review","days_after_surgery":90,"location":"in_clinic","notes":"Can be arranged with your local optometrist if you live outside Brisbane"}
]$$::jsonb,
     'Start drops 2 hours after surgery. Even if surgery is late in the afternoon, complete the day''s allocation of drops before bed (6× Ocuflox, 4× Prednefrin Forte). Leave 5 minutes between different drops — always use the artificial tears last. Do not rub your eyes for 7 days. Wear the eye shields overnight for the first week.')
  on conflict (surgeon_id, procedure_type) where archived_at is null do update set
    default_medications  = excluded.default_medications,
    default_appointments = excluded.default_appointments,
    medication_notes     = excluded.medication_notes;

  -- ── PRK ──────────────────────────────────────────────────────────────
  insert into public.procedure_templates
    (surgeon_id, procedure_type, default_medications, default_appointments, medication_notes)
  values
    (gunn_id, 'prk',
$$[
  {"name":"Tobrex","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":21,"start_offset_days":0,"taper_notes":null},
  {"name":"Acuvail","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":4,"start_offset_days":0,"taper_notes":"Each vial lasts 24 hours — re-use the same vial through the day"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to as-needed from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2 — keep using if eyes feel dry"},
  {"name":"Tetracaine 0.1%","dose":"1 drop","route":"topical eye","frequency":"hourly as needed for pain","scheduled_times":[],"duration_days":3,"start_offset_days":0,"taper_notes":"MUST stop after day 3 — do not continue beyond this"},
  {"name":"Maxigesic","dose":"2 tablets","route":"oral","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":4,"start_offset_days":0,"taper_notes":"Start before pain becomes severe — important to stay ahead of discomfort"},
  {"name":"Palexia","dose":"1 tablet (up to 2 if severe)","route":"oral","frequency":"4 times daily as needed","scheduled_times":[],"duration_days":4,"start_offset_days":0,"taper_notes":"Strong painkiller — stop immediately if nausea or vomiting (can take 6 hours to settle)"}
]$$::jsonb,
$$[
  {"appointment_type":"1 week review","days_after_surgery":7,"location":"in_clinic","notes":null},
  {"appointment_type":"3 month review","days_after_surgery":90,"location":"in_clinic","notes":"Can be arranged with your local optometrist if you live outside Brisbane"}
]$$::jsonb,
     'Start drops 2 hours after surgery. Even if surgery is late in the afternoon, complete the day''s allocation before bed (6× Tobrex, 4× Prednefrin Forte, 4× Acuvail). Leave 5 minutes between different drops — always use the artificial tears LAST so they don''t wash out the steroid or antibiotic drops. Sunglasses are essential whenever you go outside for the first 3 weeks (even briefly, even when cloudy), then most of the time for the next 3 months. PRK recovery is painful for 2–3 days — this is normal.'),
    (cronin_id, 'prk',
$$[
  {"name":"Tobrex","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":21,"start_offset_days":0,"taper_notes":null},
  {"name":"Acuvail","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":4,"start_offset_days":0,"taper_notes":"Each vial lasts 24 hours — re-use the same vial through the day"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to as-needed from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2 — keep using if eyes feel dry"},
  {"name":"Tetracaine 0.1%","dose":"1 drop","route":"topical eye","frequency":"hourly as needed for pain","scheduled_times":[],"duration_days":3,"start_offset_days":0,"taper_notes":"MUST stop after day 3 — do not continue beyond this"},
  {"name":"Maxigesic","dose":"2 tablets","route":"oral","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":4,"start_offset_days":0,"taper_notes":"Start before pain becomes severe — important to stay ahead of discomfort"},
  {"name":"Palexia","dose":"1 tablet (up to 2 if severe)","route":"oral","frequency":"4 times daily as needed","scheduled_times":[],"duration_days":4,"start_offset_days":0,"taper_notes":"Strong painkiller — stop immediately if nausea or vomiting (can take 6 hours to settle)"}
]$$::jsonb,
$$[
  {"appointment_type":"1 week review","days_after_surgery":7,"location":"in_clinic","notes":null},
  {"appointment_type":"3 month review","days_after_surgery":90,"location":"in_clinic","notes":"Can be arranged with your local optometrist if you live outside Brisbane"}
]$$::jsonb,
     'Start drops 2 hours after surgery. Even if surgery is late in the afternoon, complete the day''s allocation before bed (6× Tobrex, 4× Prednefrin Forte, 4× Acuvail). Leave 5 minutes between different drops — always use the artificial tears LAST so they don''t wash out the steroid or antibiotic drops. Sunglasses are essential whenever you go outside for the first 3 weeks (even briefly, even when cloudy), then most of the time for the next 3 months. PRK recovery is painful for 2–3 days — this is normal.')
  on conflict (surgeon_id, procedure_type) where archived_at is null do update set
    default_medications  = excluded.default_medications,
    default_appointments = excluded.default_appointments,
    medication_notes     = excluded.medication_notes;

  -- ── ICL ──────────────────────────────────────────────────────────────
  insert into public.procedure_templates
    (surgeon_id, procedure_type, default_medications, default_appointments, medication_notes)
  values
    (gunn_id, 'icl',
$$[
  {"name":"Chlorsig","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":90,"start_offset_days":0,"taper_notes":"Use whenever the eye feels scratchy or dry"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":"Do not drive yourself to this appointment, even if you feel you can"}
]$$::jsonb,
     'Leave the plastic shield on for the first 2 hours after surgery, then start the drops. Wash your hands before instilling drops. Leave 5 minutes between different drops. Do not rub your eye for 4 weeks. If you take other eye drops (for example glaucoma drops), keep using them.'),
    (cronin_id, 'icl',
$$[
  {"name":"Chlorsig","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":90,"start_offset_days":0,"taper_notes":"Use whenever the eye feels scratchy or dry"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":"Do not drive yourself to this appointment, even if you feel you can"}
]$$::jsonb,
     'Leave the plastic shield on for the first 2 hours after surgery, then start the drops. Wash your hands before instilling drops. Leave 5 minutes between different drops. Do not rub your eye for 4 weeks. If you take other eye drops (for example glaucoma drops), keep using them.')
  on conflict (surgeon_id, procedure_type) where archived_at is null do update set
    default_medications  = excluded.default_medications,
    default_appointments = excluded.default_appointments,
    medication_notes     = excluded.medication_notes;

  -- ── CLEAR ────────────────────────────────────────────────────────────
  insert into public.procedure_templates
    (surgeon_id, procedure_type, default_medications, default_appointments, medication_notes)
  values
    (gunn_id, 'clear',
$$[
  {"name":"Ocuflox","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":7,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to 4 times daily from day 8"},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":14,"start_offset_days":7,"taper_notes":"Stage 2 of 2"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to 4 times daily from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2"},
  {"name":"Oxybuprocaine","dose":"1 drop","route":"topical eye","frequency":"as needed for pain (first night only)","scheduled_times":[],"duration_days":1,"start_offset_days":0,"taper_notes":"Stings on instillation — only needed for the first night"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":null},
  {"appointment_type":"1 week review","days_after_surgery":7,"location":"in_clinic","notes":null},
  {"appointment_type":"1 month review","days_after_surgery":30,"location":"in_clinic","notes":null},
  {"appointment_type":"3 month review","days_after_surgery":90,"location":"in_clinic","notes":"Can be arranged with your local optometrist if you live outside Brisbane"}
]$$::jsonb,
     'Start drops 2 hours after surgery. Even if surgery is late in the afternoon, complete the day''s allocation of drops before bed. Leave 5 minutes between different drops — always use the artificial tears last. Do not rub your eyes for 7 days. Wear the eye shields overnight for the first week.'),
    (cronin_id, 'clear',
$$[
  {"name":"Ocuflox","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":7,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":7,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to 4 times daily from day 8"},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":14,"start_offset_days":7,"taper_notes":"Stage 2 of 2"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"6 times daily","scheduled_times":["06:00","09:00","12:00","15:00","18:00","21:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to 4 times daily from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2"},
  {"name":"Oxybuprocaine","dose":"1 drop","route":"topical eye","frequency":"as needed for pain (first night only)","scheduled_times":[],"duration_days":1,"start_offset_days":0,"taper_notes":"Stings on instillation — only needed for the first night"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":null},
  {"appointment_type":"1 week review","days_after_surgery":7,"location":"in_clinic","notes":null},
  {"appointment_type":"1 month review","days_after_surgery":30,"location":"in_clinic","notes":null},
  {"appointment_type":"3 month review","days_after_surgery":90,"location":"in_clinic","notes":"Can be arranged with your local optometrist if you live outside Brisbane"}
]$$::jsonb,
     'Start drops 2 hours after surgery. Even if surgery is late in the afternoon, complete the day''s allocation of drops before bed. Leave 5 minutes between different drops — always use the artificial tears last. Do not rub your eyes for 7 days. Wear the eye shields overnight for the first week.')
  on conflict (surgeon_id, procedure_type) where archived_at is null do update set
    default_medications  = excluded.default_medications,
    default_appointments = excluded.default_appointments,
    medication_notes     = excluded.medication_notes;

  -- ── CATARACT ─────────────────────────────────────────────────────────
  insert into public.procedure_templates
    (surgeon_id, procedure_type, default_medications, default_appointments, medication_notes)
  values
    (gunn_id, 'cataract',
$$[
  {"name":"Ilevro","dose":"1 drop","route":"topical eye","frequency":"once daily","scheduled_times":["08:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to as-needed from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2 — keep using 2–3 times daily for 2–3 months"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":"May be same day as surgery depending on timing. Do not drive yourself."}
]$$::jsonb,
     'Leave the shield on for the first 2 hours after surgery, then start the drops. Wash your hands before instilling drops. Leave 5 minutes between different drops. If you take other eye drops (for example glaucoma drops), keep using them. One bottle of artificial tears can be used in both eyes.'),
    (cronin_id, 'cataract',
$$[
  {"name":"Ilevro","dose":"1 drop","route":"topical eye","frequency":"once daily","scheduled_times":["08:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to as-needed from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2 — keep using 2–3 times daily for 2–3 months"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":"May be same day as surgery depending on timing. Do not drive yourself."}
]$$::jsonb,
     'Leave the shield on for the first 2 hours after surgery, then start the drops. Wash your hands before instilling drops. Leave 5 minutes between different drops. If you take other eye drops (for example glaucoma drops), keep using them. One bottle of artificial tears can be used in both eyes.')
  on conflict (surgeon_id, procedure_type) where archived_at is null do update set
    default_medications  = excluded.default_medications,
    default_appointments = excluded.default_appointments,
    medication_notes     = excluded.medication_notes;

  -- ── RLE (same protocol as Cataract per the clinic doc) ──────────────
  insert into public.procedure_templates
    (surgeon_id, procedure_type, default_medications, default_appointments, medication_notes)
  values
    (gunn_id, 'rle',
$$[
  {"name":"Ilevro","dose":"1 drop","route":"topical eye","frequency":"once daily","scheduled_times":["08:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to as-needed from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2 — keep using 2–3 times daily for 2–3 months"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":"May be same day as surgery depending on timing. Do not drive yourself."}
]$$::jsonb,
     'Leave the shield on for the first 2 hours after surgery, then start the drops. Wash your hands before instilling drops. Leave 5 minutes between different drops. If you take other eye drops (for example glaucoma drops), keep using them. Wait 5 weeks before getting new glasses — your prescription will settle. If we''re doing one eye at a time, the gap between eyes can feel a bit off-balance — that''s normal.'),
    (cronin_id, 'rle',
$$[
  {"name":"Ilevro","dose":"1 drop","route":"topical eye","frequency":"once daily","scheduled_times":["08:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":null},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":28,"start_offset_days":0,"taper_notes":"Stage 1 of 2 — drops to as-needed from week 5"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":56,"start_offset_days":28,"taper_notes":"Stage 2 of 2 — keep using 2–3 times daily for 2–3 months"}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":"May be same day as surgery depending on timing. Do not drive yourself."}
]$$::jsonb,
     'Leave the shield on for the first 2 hours after surgery, then start the drops. Wash your hands before instilling drops. Leave 5 minutes between different drops. If you take other eye drops (for example glaucoma drops), keep using them. Wait 5 weeks before getting new glasses — your prescription will settle. If we''re doing one eye at a time, the gap between eyes can feel a bit off-balance — that''s normal.')
  on conflict (surgeon_id, procedure_type) where archived_at is null do update set
    default_medications  = excluded.default_medications,
    default_appointments = excluded.default_appointments,
    medication_notes     = excluded.medication_notes;

  -- ── PTERYGIUM ────────────────────────────────────────────────────────
  -- IMPORTANT: drops start the DAY AFTER surgery (start_offset_days = 1),
  -- but Maxigesic starts on day 0 (before bed even if no pain).
  insert into public.procedure_templates
    (surgeon_id, procedure_type, default_medications, default_appointments, medication_notes)
  values
    (gunn_id, 'pterygium',
$$[
  {"name":"Chlorsig","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"start_offset_days":1,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":42,"start_offset_days":1,"taper_notes":"Try to direct one drop up under the upper eyelid — that area can become quite inflamed"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":90,"start_offset_days":1,"taper_notes":"Use whenever the eye feels scratchy or dry"},
  {"name":"Maxigesic","dose":"up to 2 tablets","route":"oral","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"start_offset_days":0,"taper_notes":"Take with food. Take before bed on the day of surgery even if no pain. Don''t take if already on paracetamol or ibuprofen."}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":"Do not drive yourself, even if you feel you can"}
]$$::jsonb,
     'Eye drops start the DAY AFTER surgery — NOT on the day of the procedure. Take Maxigesic before bed on the day of surgery even if you feel fine. Leave 5 minutes between different drops. Pterygium is caused by sun damage — wear a hat and wrap-around sunglasses every time you go outside to prevent recurrence. Avoid cheap sunglasses that may not block UV.'),
    (cronin_id, 'pterygium',
$$[
  {"name":"Chlorsig","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"start_offset_days":1,"taper_notes":null},
  {"name":"Prednefrin Forte","dose":"1 drop","route":"topical eye","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":42,"start_offset_days":1,"taper_notes":"Try to direct one drop up under the upper eyelid — that area can become quite inflamed"},
  {"name":"Artificial tears","dose":"1 drop","route":"topical eye","frequency":"as needed","scheduled_times":[],"duration_days":90,"start_offset_days":1,"taper_notes":"Use whenever the eye feels scratchy or dry"},
  {"name":"Maxigesic","dose":"up to 2 tablets","route":"oral","frequency":"4 times daily","scheduled_times":["08:00","12:00","16:00","20:00"],"duration_days":7,"start_offset_days":0,"taper_notes":"Take with food. Take before bed on the day of surgery even if no pain. Don''t take if already on paracetamol or ibuprofen."}
]$$::jsonb,
$$[
  {"appointment_type":"Day 1 review","days_after_surgery":1,"location":"in_clinic","notes":"Do not drive yourself, even if you feel you can"}
]$$::jsonb,
     'Eye drops start the DAY AFTER surgery — NOT on the day of the procedure. Take Maxigesic before bed on the day of surgery even if you feel fine. Leave 5 minutes between different drops. Pterygium is caused by sun damage — wear a hat and wrap-around sunglasses every time you go outside to prevent recurrence. Avoid cheap sunglasses that may not block UV.')
  on conflict (surgeon_id, procedure_type) where archived_at is null do update set
    default_medications  = excluded.default_medications,
    default_appointments = excluded.default_appointments,
    medication_notes     = excluded.medication_notes;

end $seed$;

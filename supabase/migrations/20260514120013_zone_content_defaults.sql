-- Default zone_content rows (wildcard procedure and surgeon).
-- One row per patient_zone; the lookup uses the same most-specific-wins
-- 4-tier fallback as routing_rules — (procedure × surgeon) → surgeon-only →
-- procedure-only → default. These NULL/NULL rows are the default tier.

insert into public.zone_content (
  zone, procedure_type, surgeon_id, headline, message,
  expected_symptoms, today_tip, instructions, warning
) values
  ('green',
   null, null,
   'You''re on track',
   'Your check-in looks like a typical recovery day. Keep taking your drops on schedule and rest your eyes when they feel tired.',
   '{"mild watering","occasional grittiness","slight light sensitivity"}',
   'Try wearing sunglasses outdoors today, even if it''s overcast — bright light is the most common cause of eye fatigue this week.',
   'Continue your medication schedule. No changes needed.',
   null),
  ('yellow',
   null, null,
   'A few things to keep an eye on',
   'Some of what you''re feeling today is worth watching. It''s usually nothing serious, but if it gets worse — or stays this way for another day — let the clinic know.',
   '{"halos around lights","light sensitivity","mild ache"}',
   'Take a 10-minute break from screens every hour today, and use your lubricating drops more often if your eyes feel dry.',
   'Continue your prescribed drops. If symptoms persist into tomorrow''s check-in, message the clinic from the home screen.',
   'If you experience sudden vision changes, severe pain, or flashes of light, contact the clinic immediately.'),
  ('orange',
   null, null,
   'We''d like to hear from you today',
   'Based on your check-in, we''d like to speak with you today to make sure everything is on track. A member of the care team will be in touch shortly.',
   '{}',
   null,
   'Continue your drops as prescribed. Avoid rubbing your eyes and keep them shielded from bright light.',
   'If your symptoms worsen, or you experience sudden vision loss or severe pain before we reach you, call the clinic directly using the Contact button on the home screen.')
on conflict (zone, procedure_type, surgeon_id) do nothing;

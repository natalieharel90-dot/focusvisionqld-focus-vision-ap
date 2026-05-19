-- Real pre-op education from the Focus Vision patient brochures.
--   1. surgery_day_text on every procedure_template — surfaced on the
--      patient pre-op screen as "What to expect on surgery day".
--   2. FAQs per procedure — surfaced as "Common questions". Replaces
--      the three placeholder LASIK FAQs seeded in migration 069.

-- ── surgery_day_text per procedure (shared across both surgeons) ─────

update public.procedure_templates set surgery_day_text =
$ld$You''ll be at the clinic for about 2 hours.

When you arrive, you''ll change into a gown and shoe covers. The team will go through your consent form again and answer any last questions.

Numbing drops are placed in your eye — they sting briefly, then your eye is completely numb. You''ll be offered a mild sedative to help you relax.

In the laser room, you''ll lie on a comfortable bed. A small speculum holds your eyelids open so you can''t blink. The first laser creates a thin corneal flap — you''ll feel firm pressure and your vision will go dark for a few seconds. The second laser reshapes the cornea underneath — you''ll watch a blinking green light, hear a clicking sound, and may notice a faint burning smell (this is normal). Eye-tracking technology compensates for any tiny eye movement 1,050 times per second.

The procedure itself takes about 25 minutes for both eyes. There''s no pain — just pressure.

Afterwards, clear plastic shields are placed over your eyes — wear them home and overnight. Your vision will be blurry and your eyes will water and feel scratchy. Most patients sleep for a few hours when they get home and feel much better when they wake.

Your Day-1 review is the next morning. Your carer will need to drive you — please don''t drive yourself.$ld$
where procedure_type = 'lasik' and archived_at is null;

update public.procedure_templates set surgery_day_text =
$ld$You''ll be at the clinic for about 2 hours.

When you arrive, you''ll change into a gown and shoe covers. The team will go through your consent again.

Numbing drops are placed in your eye, then a small speculum holds your eyelids open. The surface cells of the cornea (the epithelium) are gently removed — these will regrow over the next 3–4 days. The excimer laser then reshapes the cornea underneath. The laser part rarely takes more than 60 seconds; you''ll watch a blinking green light. There''s no pain during the procedure.

A small medicated disc is placed on the cornea for 20 seconds, then a very cold rinse for a few seconds, and finally a soft bandage contact lens. If the bandage lens falls out at home, discard it.

You''ll be heading home with a carer — you cannot drive. The first night is the most uncomfortable: take the Maxigesic on schedule (before pain builds), keep your eyes closed, and try music or audiobooks to pass the time. Ice packs over closed lids can help.

Sunglasses outdoors are essential from now on — for 3 weeks strictly, then most of the time for 3 months. Without them, UV can cause a scarring reaction (haze) that can permanently dull your vision.$ld$
where procedure_type = 'prk' and archived_at is null;

update public.procedure_templates set surgery_day_text =
$ld$You''ll be at the clinic for 2–3 hours.

You''ll change into a gown and shoe covers, and the team will go through your consent again. Numbing drops are placed in your eye — they sting briefly, then it''s completely numb. You''ll be offered a mild sedative.

In the laser room, the laser lowers onto your eye — you''ll feel firm pressure and your vision will go dark for about a minute while the laser forms a small lens-shaped piece of tissue (a lenticule) inside your cornea. Then a microscope and very delicate instruments are used to separate and remove the lenticule through a tiny keyhole incision — not painful, but you''ll feel gentle manipulation on the surface.

The procedure takes around 25 minutes per eye. There''s no flap, so the eye is left stronger than with LASIK and you have much less dry eye than with LASIK or PRK.

Afterwards, clear plastic shields are placed over your eyes — wear them home and overnight. Your vision will be very blurry and your eyes scratchy. Most patients sleep when they get home and feel much better when they wake.

Your Day-1 review is the next morning. Your carer will drive you — please don''t drive yourself.$ld$
where procedure_type = 'clear' and archived_at is null;

update public.procedure_templates set surgery_day_text =
$ld$You''ll be at the clinic for 3–4 hours. The procedure is done in hospital with an IV cannula and heavy sedation — you almost certainly won''t remember it.

When you arrive, you''ll change into a gown. Dilating drops are placed in the eye, and an IV cannula is inserted in your hand. You''ll be moved to the operating room.

A special anaesthetic gel completely numbs the eye, and you''re heavily sedated through the cannula. The surgeon makes very small incisions in the cornea and inserts the custom-made ICL behind your iris, in front of your natural lens. Both eyes are done in the same session, one after the other — about 30 minutes per eye.

You''ll wake in recovery, have a drink and a sandwich, and the optometrist will check your eyes after about 2 hours. Most people are then ready to go home with their escort.

Your vision will be blurry the first night and your eye will feel scratchy. Wear the eye shield when you sleep. Someone should be with you overnight. Your Day-1 review is the next morning — your carer will drive you.

Important: if you develop a significant headache in the first 24 hours, call your surgeon immediately.$ld$
where procedure_type = 'icl' and archived_at is null;

update public.procedure_templates set surgery_day_text =
$ld$You''ll be at the clinic for about 3 hours.

When you arrive, you''ll change into a gown and shoe covers. Dilating drops are placed in your eye, and an IV cannula is inserted in your hand. The team will go through your consent again.

A special anaesthetic gel completely numbs the eye, and you''re heavily sedated through the cannula — most patients don''t remember the operation at all. The surgeon makes very small incisions in the cornea, opens the front of the lens capsule, and removes the natural lens with ultrasound (phacoemulsification). The custom-chosen intraocular lens is then inserted through the same small incision and held in place by the capsule.

You''ll wake in recovery, have a drink and a sandwich, and after about 30 minutes to an hour you''ll be ready to go home with your escort. Your Day-1 review is either the same day or next day depending on timing — please don''t drive yourself.

The eye will be blurry, scratchy, and possibly watery for the first day. Wear the eye shield to sleep. We only operate on one eye at a time — the second eye is scheduled 1 day to 2 weeks later. The gap can feel a bit off-balance, especially if your glasses were strong; that''s normal.$ld$
where procedure_type in ('rle', 'cataract') and archived_at is null;

update public.procedure_templates set surgery_day_text =
$ld$You''ll be at the clinic for about 3–4 hours.

The procedure is done in hospital under heavy sedation — you won''t remember it. A sterile drape covers your face during surgery with tubing that blows in plenty of fresh air; staff are watching you closely the whole time.

When you arrive, you''ll change into a gown and shoe covers. An IV cannula is inserted, and you''ll be sedated. The surgeon removes the pterygium tissue from the surface of your eye and transplants a small piece of clear tissue from under your upper eyelid to cover the area — no stitches, the tissue is sealed with fibrin glue. The whole operation takes about 45 minutes.

At the end of surgery, an antibiotic from the cephalosporin family (Keflex / Cefaclor / Kefazol) is injected — please tell the team if you''ve ever had a reaction to those.

You''ll wake in recovery and have a drink and a sandwich. After 30 minutes to an hour, your escort takes you home. Your eye will be padded and shielded overnight — leave the dressings on; if they come loose, that''s fine. Mild blood-stained tears are normal for the first day or two.

Your Day-1 review is the next morning. Take the Maxigesic before bed even if you feel fine — the local anaesthetic wears off overnight.$ld$
where procedure_type = 'pterygium' and archived_at is null;

-- ── FAQs ─────────────────────────────────────────────────────────────────
-- Remove the three placeholder LASIK FAQs from migration 069 first.
delete from public.content_items
  where type = 'faq'
    and procedures = array['lasik']
    and audience = 'pre_op'
    and title in (
      'Will the surgery hurt?',
      'How long does the procedure take?',
      'When will I see clearly?'
    );

insert into public.content_items (type, title, body, procedures, audience) values

-- ─────────────── LASIK ───────────────
('faq', 'Will it hurt?',
 'Numbing drops mean you''ll feel pressure but no pain. A small speculum holds your eyelids open so you can''t blink.',
 array['lasik'], 'pre_op'),
('faq', 'How long will I be at the clinic?',
 'About 2 hours. The laser itself takes about 25 minutes for both eyes.',
 array['lasik'], 'pre_op'),
('faq', 'What if my eye moves during surgery?',
 'Eye-tracking technology compensates 1,050 times per second. If you move too much, the laser pauses until your eye returns to position — you don''t need to hold yourself still.',
 array['lasik'], 'pre_op'),
('faq', 'Will I still need reading glasses after 40?',
 'Yes, for reading. Laser doesn''t prevent presbyopia (the age-related loss of near focus). If you''ve tried blended vision in contact lenses and liked it, we can offer it permanently with laser.',
 array['lasik'], 'pre_op'),
('faq', 'How much time off work?',
 'Two days. Most patients see well the day after surgery. Plan to have your carer drive you — don''t drive yourself.',
 array['lasik'], 'pre_op'),

-- ─────────────── PRK ───────────────
('faq', 'Why is PRK more painful than LASIK?',
 'PRK gently removes the surface cells of the cornea (the epithelium), which then regrow over 3–4 days. That regrowth is what''s sore. We give you strong pain medication — start it before pain builds, not after.',
 array['prk'], 'pre_op'),
('faq', 'When can I drive again?',
 'Usually around day 5–7, once your vision is good enough for legal driving. We''ll confirm at your 1-week review.',
 array['prk'], 'pre_op'),
('faq', 'Why are sunglasses so important after PRK?',
 'Without them, UV can cause a scarring reaction called haze that can permanently dull your vision. Wear them outdoors strictly for the first 3 weeks (even briefly, even when cloudy), then most of the time for 3 months.',
 array['prk'], 'pre_op'),
('faq', 'Why is my vision worse on day 3 or 4?',
 'That''s the corneal surface healing — it gets worse before it gets better. Vision usually improves again from day 5. Keep going and stay on the drops.',
 array['prk'], 'pre_op'),
('faq', 'How much time off work?',
 'About a week. Your vision won''t be sharp enough for screen work before then.',
 array['prk'], 'pre_op'),

-- ─────────────── CLEAR ───────────────
('faq', 'How is CLEAR different from LASIK?',
 'There''s no flap. The laser shapes a small piece of tissue (lenticule) inside the cornea and we remove it through a tiny incision. The eye is left stronger, and dry eye is much less of an issue than with LASIK or PRK.',
 array['clear'], 'pre_op'),
('faq', 'How long does the procedure take?',
 'About 25 minutes per eye. You''re at the clinic for 2–3 hours.',
 array['clear'], 'pre_op'),
('faq', 'How fast is recovery?',
 'Faster than PRK; similar to LASIK on day 1. Vision fluctuates for the first week — some patients see well after a day, others take 5–7 days. Plan 2 days off work; some take longer.',
 array['clear'], 'pre_op'),
('faq', 'Will I still need glasses?',
 'For reading after 40–45, yes — CLEAR doesn''t prevent presbyopia. Distance vision is usually very good without glasses.',
 array['clear'], 'pre_op'),
('faq', 'Is CLEAR better for dry eye?',
 'Yes. CLEAR treats far fewer corneal nerves than LASIK or PRK, so dry eye is much less of an issue.',
 array['clear'], 'pre_op'),

-- ─────────────── RLE / Cataract ───────────────
('faq', 'How is RLE different from cataract surgery?',
 'Technically it''s the same operation — we''re just replacing a clear natural lens before it becomes a cataract.',
 array['rle','cataract'], 'pre_op'),
('faq', 'Are both eyes done the same day?',
 'No. We do one eye, then the second 1 day to 2 weeks later. You won''t feel perfectly balanced during the gap — most patients manage fine.',
 array['rle','cataract'], 'pre_op'),
('faq', 'Will I still need glasses?',
 'Depends on the lens. A standard monofocal lens leaves you needing reading glasses. A multifocal or trifocal lens means about 95% of patients don''t need glasses for everyday tasks. EDOF lenses sit between the two.',
 array['rle','cataract'], 'pre_op'),
('faq', 'What about haloes around lights at night?',
 'Most multifocal patients see some haloes at first. They''re usually mild and most people stop noticing them within 12 months as the brain adapts. About 1 in 30 finds them bothersome enough to avoid night driving — we''ll talk through this before you choose a lens.',
 array['rle','cataract'], 'pre_op'),
('faq', 'What about my blood thinners?',
 'Keep taking them. The eye can bruise a little more but stopping them carries other risks. Just tell the team you''re on them.',
 array['rle','cataract'], 'pre_op'),
('faq', 'Does Medicare cover this?',
 'Only if your doctor has diagnosed a cataract. RLE for refractive reasons alone is classified as cosmetic — no Medicare or insurance rebate. We can give you a full quote for the out-of-pocket cost.',
 array['rle','cataract'], 'pre_op'),

-- ─────────────── ICL ───────────────
('faq', 'Can the ICL come out?',
 'Yes — it''s removable. That''s one of its major benefits. We''d remove it if you needed cataract surgery later (often 40s–70s), or if there was any issue.',
 array['icl'], 'pre_op'),
('faq', 'How long does the operation take?',
 'About 30 minutes per eye. Both eyes are done the same session, one after the other. You''re at the clinic for 3–4 hours.',
 array['icl'], 'pre_op'),
('faq', 'Why does ICL cost more than laser?',
 'The lens is custom-made and imported, the surgery is in hospital with a specialist anaesthetist, and you''re under heavy sedation. The package fee covers hospital, surgeon, anaesthetist, and 12 months of follow-up.',
 array['icl'], 'pre_op'),
('faq', 'I''m long-sighted — what''s the iridotomy?',
 'A small laser hole in the iris that keeps fluid flowing freely after we place the ICL. We do it in clinic at least one week before surgery. Short-sighted patients don''t need it.',
 array['icl'], 'pre_op'),
('faq', 'Will I see haloes around lights?',
 'Most people do at first — small rings around lights, especially at night. Almost everyone adapts within a few months and stops noticing them.',
 array['icl'], 'pre_op'),
('faq', 'What about my blood thinners?',
 'Keep taking them. The minor bruising risk is much smaller than the risks of stopping. Just let the team know.',
 array['icl'], 'pre_op'),

-- ─────────────── Pterygium ───────────────
('faq', 'Will the pterygium come back?',
 'Recurrence is rare — about 1 in 1,000 with the technique we use. Daily sun protection (a hat and proper wrap-around sunglasses) keeps the risk low. Avoid cheap sunglasses that may not block UV.',
 array['pterygium'], 'pre_op'),
('faq', 'How long does the surgery take?',
 'About 45 minutes. You''ll be heavily sedated and won''t remember it.',
 array['pterygium'], 'pre_op'),
('faq', 'When can I drive again?',
 'Usually 2–4 days, once your vision is back to normal and the eye is wide open.',
 array['pterygium'], 'pre_op'),
('faq', 'Why is my eye so red afterwards?',
 'That''s expected. The eye stays red for 3–6 weeks while it heals. It does clear up.',
 array['pterygium'], 'pre_op'),
('faq', 'Will my glasses prescription change?',
 'Likely yes — the pterygium was pulling on your cornea and changing its shape. The prescription settles over about 3 months; wait for the eye to stabilise before updating glasses.',
 array['pterygium'], 'pre_op'),
('faq', 'Any allergies I should mention?',
 'Yes — at the end of surgery we inject a cephalosporin antibiotic (Keflex, Cefaclor or Kefazol family). Tell us if you''ve ever had a reaction to those, or to Iodine (Betadine) or Chlorhexidine.',
 array['pterygium'], 'pre_op');

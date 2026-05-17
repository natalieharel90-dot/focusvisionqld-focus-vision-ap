-- The surgeon's written welcome message — shown as the transcript on the
-- patient "A message from your surgeon" screen, alongside their welcome
-- video. Editable per surgeon in Settings → Clinic & Staff.
alter table public.staff_users add column welcome_message text;

-- Seed a generic welcome message for surgeons who already have a welcome
-- video, so the spotlight screen is populated in development.
update public.staff_users
  set welcome_message =
    'Hi — welcome to your recovery. I want you to know everything went '
    || 'beautifully today. Over the next few days you might notice some '
    || 'fluctuating vision, mild halos at night, and a bit of grittiness — '
    || 'all completely expected. Take it easy, use your drops on schedule, '
    || 'and the team will be checking in with you every day. Talk to me at '
    || 'your week-one review.'
  where role = 'surgeon' and welcome_video_url is not null;

-- Drop the voice_control toggle — the patient preferences UI included
-- it but nothing in the codebase ever read the flag. Removing the
-- column too so the schema matches the UI.

alter table public.user_preferences
  drop column voice_control;

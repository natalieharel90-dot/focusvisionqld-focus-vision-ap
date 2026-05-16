-- Let pinned content reference a real content_items row, or carry an
-- ad-hoc reassurance message — instead of only a free-text label.
alter table public.patient_pinned_content
  add column content_id uuid references public.content_items(id) on delete cascade,
  add column ad_hoc_message text;

-- label is now optional (a library pin carries content_id instead).
alter table public.patient_pinned_content
  alter column label drop not null;

-- Every pin must still point at something.
alter table public.patient_pinned_content
  add constraint patient_pinned_content_has_target
  check (
    content_id is not null
    or ad_hoc_message is not null
    or label is not null
  );

-- Backfill: match an existing label to a content_items title where we
-- can; otherwise keep it as an ad-hoc message so it still renders.
update public.patient_pinned_content pc
  set content_id = ci.id
  from public.content_items ci
  where pc.content_id is null
    and pc.label is not null
    and lower(btrim(pc.label)) = lower(btrim(ci.title));

update public.patient_pinned_content
  set ad_hoc_message = label
  where content_id is null
    and ad_hoc_message is null
    and label is not null;

-- The content library now exists, so a bulk push can attach existing
-- content items. content_item_ids records which were sent; the items are
-- composed into the delivered message body at send time, so the existing
-- fire_bulk_push fan-out is unchanged.
alter table public.bulk_pushes
  add column content_item_ids uuid[] not null default '{}';

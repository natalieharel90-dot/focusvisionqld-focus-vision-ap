-- Patient-facing read of the post-op content for their own procedure.
-- procedure_templates is staff-only (RLS), so this SECURITY DEFINER
-- function resolves the caller's active procedure → its source template
-- → the template's default_postop_content_ids → content_items. Scoped
-- to auth.uid(), so a patient only ever sees their own procedure's set.
create or replace function public.my_postop_content()
returns setof public.content_items
language sql
stable
security definer
set search_path = public
as $$
  select distinct ci.*
  from public.content_items ci
  join public.procedure_templates pt
    on ci.id = any (pt.default_postop_content_ids)
  join public.procedures p
    on p.source_template_id = pt.id
   and p.patient_id = auth.uid()
   and p.status = 'active'
$$;

revoke all on function public.my_postop_content() from public;
grant execute on function public.my_postop_content() to authenticated;

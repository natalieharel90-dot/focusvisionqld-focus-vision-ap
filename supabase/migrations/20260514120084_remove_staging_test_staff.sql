-- One-off staging cleanup: remove the original seed/test staff users
-- (Dr Chen, Dr Nguyen) so the staff list contains only real clinic
-- staff. Harmless on any other database — these seed IDs simply won't
-- exist there.
--
-- The procedure templates that referenced these surgeons (the seeded
-- Dr Chen × LASIK / Cataract, Dr Nguyen × PRK from migration 022)
-- were replaced with real Dr Gunn / Dr Cronin templates in migration
-- 080; deleting them here just removes the orphans.
--
-- Strategy: walk every FK that points to staff_users(id), and either
-- NULL the matching column (when the column is nullable) or DELETE the
-- row (when the column is NOT NULL). The two on-delete-cascade FKs
-- (notification_prefs, analytics card order) are cleaned automatically
-- when staff_users is deleted at the end.
--
-- The audit-log append-only triggers are briefly lifted so we can NULL
-- audit_events.actor_staff_id — restored in the same transaction.

do $cleanup$
declare
  test_ids uuid[] := array[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid
  ];
  fkrec record;
  sql text;
begin
  alter table public.audit_events disable trigger audit_events_block_update;
  alter table public.audit_events disable trigger audit_events_block_delete;

  -- zone_content and routing_rulesets have UNIQUE NULLS NOT DISTINCT on
  -- (..., surgeon_id), so NULLing a surgeon-specific row would collide
  -- with the procedure-only (surgeon_id NULL) row. The test surgeons'
  -- overrides are stale anyway — just delete them.
  delete from public.zone_content
    where surgeon_id = any(test_ids);
  delete from public.routing_rulesets
    where surgeon_id = any(test_ids);

  for fkrec in
    select
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      col.is_nullable,
      rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on  tc.constraint_name   = kcu.constraint_name
      and tc.table_schema      = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on  tc.constraint_name   = ccu.constraint_name
      and tc.table_schema      = ccu.table_schema
    join information_schema.referential_constraints rc
      on  tc.constraint_name   = rc.constraint_name
      and tc.table_schema      = rc.constraint_schema
    join information_schema.columns col
      on  col.table_schema     = kcu.table_schema
      and col.table_name       = kcu.table_name
      and col.column_name      = kcu.column_name
    where tc.constraint_type   = 'FOREIGN KEY'
      and ccu.table_schema     = 'public'
      and ccu.table_name       = 'staff_users'
      and ccu.column_name      = 'id'
      and tc.table_schema      = 'public'
  loop
    -- CASCADE FKs are handled when staff_users is deleted at the end.
    if fkrec.delete_rule = 'CASCADE' then
      continue;
    end if;

    if fkrec.is_nullable = 'YES' then
      sql := format(
        'update %I.%I set %I = null where %I = any($1)',
        fkrec.table_schema, fkrec.table_name,
        fkrec.column_name,  fkrec.column_name
      );
    else
      sql := format(
        'delete from %I.%I where %I = any($1)',
        fkrec.table_schema, fkrec.table_name, fkrec.column_name
      );
    end if;
    execute sql using test_ids;
  end loop;

  delete from public.staff_users where id = any(test_ids);

  -- Free the corresponding auth accounts so the emails can be reused.
  delete from auth.users where id = any(test_ids);

  alter table public.audit_events enable trigger audit_events_block_update;
  alter table public.audit_events enable trigger audit_events_block_delete;
end
$cleanup$;

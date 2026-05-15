-- Audit log viewer support: staff access tiers, composite indexes for
-- the filterable/paginated query, and a hard append-only guard.

-- ── access_tier on staff_users ───────────────────────────────────────────
-- Org access tier, distinct from the clinical staff_role enum:
--   1 = Owner / Admin / Clinical Lead — full access incl. the audit log
--   2 = clinical staff
--   3 = reception / limited
-- Defaults to 1 so existing staff keep working; a clinic demotes as
-- needed. Only tier 1 may view /audit.

alter table public.staff_users
  add column access_tier smallint not null default 1
  check (access_tier between 1 and 3);

comment on column public.staff_users.access_tier is
  'Org access tier: 1=Owner/Admin/Clinical Lead, 2=clinical, 3=limited.';

-- ── Indexes for the audit query ──────────────────────────────────────────
-- The viewer filters by actor / patient / event_type and always orders by
-- created_at DESC. Composite indexes keep the plan an Index Scan as the
-- table grows into the millions of rows.

create index audit_events_actor_created_idx
  on public.audit_events (actor_staff_id, created_at desc);

create index audit_events_patient_created_idx
  on public.audit_events (patient_id, created_at desc);

create index audit_events_event_type_created_idx
  on public.audit_events (event_type, created_at desc);

-- The plain single-column actor index is now subsumed by the composite.
drop index if exists public.audit_events_actor_idx;

-- ── Append-only guard ────────────────────────────────────────────────────
-- RLS already blocks UPDATE/DELETE for anon + authenticated (migration 8),
-- but RLS does NOT apply to service_role. A trigger fires for every role
-- (service_role included) — it's the real enforcement of "append-only,
-- retained 7 years". A superuser can still disable the trigger for an
-- eventual retention purge; service_role cannot.

create or replace function public.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'audit_events is append-only — % is not permitted', tg_op;
end;
$$;

create trigger audit_events_block_update
  before update on public.audit_events
  for each row execute function public.reject_audit_mutation();

create trigger audit_events_block_delete
  before delete on public.audit_events
  for each row execute function public.reject_audit_mutation();

-- Belt-and-suspenders at the privilege level too.
revoke update, delete on public.audit_events from service_role;

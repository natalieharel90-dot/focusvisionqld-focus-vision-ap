-- Routing rulesets + per-item rules + recovery-guidance content lookups.
-- See spec section 6.7 and CLAUDE.md "Routing model".

-- A named bundle of routing rules. (procedure, surgeon_id) scoping uses
-- most-specific-match-wins at evaluation time, with per-rule fallback up
-- the four-tier hierarchy: (procedure × surgeon) → surgeon-only →
-- procedure-only → default.
create table public.routing_rulesets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  procedure_type text,
  surgeon_id uuid references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Treat NULLs as the same value for uniqueness so each scope has one
  -- canonical ruleset. Two partial unique indexes cover the NULL cases.
  unique nulls not distinct (procedure_type, surgeon_id)
);

create trigger set_updated_at
before update on public.routing_rulesets
for each row execute function public.set_updated_at();

-- One row per (item × value). For graded items (pain, light_sensitivity)
-- there are 6 rows (levels 0–5); for vision 3 rows (worse/same/better);
-- for symptom chips 1 row (true). The single 'route' column is the
-- four-option router; Red includes staff escalation so no separate boolean
-- is needed.
create table public.routing_rules (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references public.routing_rulesets(id) on delete cascade,
  item_key text not null,
  item_value text not null,
  route public.route_action not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ruleset_id, item_key, item_value)
);

create trigger set_updated_at
before update on public.routing_rules
for each row execute function public.set_updated_at();

create index routing_rules_ruleset_idx on public.routing_rules (ruleset_id);

-- Recovery-guidance content (the patient-facing copy shown on the result
-- screen). (zone × procedure × surgeon) — NULL = wildcard. Lookup uses the
-- same most-specific-wins as routing.
create table public.zone_content (
  id uuid primary key default gen_random_uuid(),
  zone public.patient_zone not null,
  procedure_type text,
  surgeon_id uuid references public.staff_users(id),
  headline text not null,
  message text not null,
  expected_symptoms text[] not null default '{}',
  today_tip text,
  instructions text,
  warning text,
  updated_by uuid references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (zone, procedure_type, surgeon_id)
);

create trigger set_updated_at
before update on public.zone_content
for each row execute function public.set_updated_at();

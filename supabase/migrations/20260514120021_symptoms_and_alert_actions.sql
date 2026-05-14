-- Settings tables: symptom_options + zone_alert_actions
-- + trigger that auto-creates a routing_rules row when a new symptom is
--   added (route='orange' per spec — safer default).

-- ── symptom_options ───────────────────────────────────────────────────────

create table public.symptom_options (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,    -- snake_case; used in chip:<key> routing rules
  label text not null,
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.symptom_options
for each row execute function public.set_updated_at();

alter table public.symptom_options enable row level security;

create policy symptom_options_staff_select on public.symptom_options
  for select using (public.is_staff());
create policy symptom_options_staff_write on public.symptom_options
  for all using (public.is_staff()) with check (public.is_staff());

-- Anonymous read access for patient app to render chips. Read-only.
create policy symptom_options_authenticated_select on public.symptom_options
  for select to authenticated
  using (active);

-- Seed the existing chips from earlier routing migrations so they show
-- up as managed symptoms (and the editor can render rows for them).
insert into public.symptom_options (key, label, order_index, active) values
  ('flashes_of_light',   'Flashes of light',          10, true),
  ('shadow_curtain',     'Shadow or curtain in vision', 20, true),
  ('sudden_vision_loss', 'Sudden vision loss',        30, true),
  ('severe_pain',        'Severe pain',               40, true),
  ('eye_pain',           'Eye pain',                  50, true),
  ('discharge',          'Discharge',                 60, true),
  ('floaters',           'Floaters',                  70, true),
  ('halos',              'Halos around lights',       80, true),
  ('itching',            'Itching',                   90, true),
  ('watering',           'Watering',                 100, true),
  ('grittiness',         'Grittiness',               110, true)
on conflict (key) do nothing;

-- Auto-create a routing_rules row in the default ruleset for any new
-- symptom_option, with route='orange' (safer default per spec section 6.7).
-- Existing chips already have rules from earlier migrations — the
-- on-conflict-do-nothing in the trigger keeps things idempotent.
create or replace function public.handle_new_symptom_option()
returns trigger
language plpgsql
as $$
declare
  default_ruleset_id uuid;
begin
  if not new.active then return new; end if;

  select id into default_ruleset_id
  from public.routing_rulesets
  where procedure_type is null and surgeon_id is null
  limit 1;

  if default_ruleset_id is not null then
    insert into public.routing_rules (ruleset_id, item_key, item_value, route)
    values (default_ruleset_id, 'chip:' || new.key, 'true', 'orange')
    on conflict (ruleset_id, item_key, item_value) do nothing;
  end if;

  return new;
end;
$$;

create trigger symptom_option_creates_routing_rule
after insert on public.symptom_options
for each row execute function public.handle_new_symptom_option();

-- ── zone_alert_actions ────────────────────────────────────────────────────
-- Per-level alert action configuration. One row per staff_alert_level
-- (yellow/orange/red — 'none' has no actions). 'red' patient-facing
-- behaviour is unchanged; staff actions are what these toggles control.

create table public.zone_alert_actions (
  alert_level public.staff_alert_level primary key,
  email_clinic boolean not null default true,
  inapp_to_all boolean not null default true,
  push_to_oncall boolean not null default false,
  sms_oncall boolean not null default false,
  autocall_oncall boolean not null default false,
  additional_email text,
  oncall_number text,
  updated_by uuid references public.staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 'none' is meaningless here — only routable levels get a row.
  constraint zone_alert_actions_level check (alert_level <> 'none')
);

create trigger set_updated_at
before update on public.zone_alert_actions
for each row execute function public.set_updated_at();

alter table public.zone_alert_actions enable row level security;
create policy zone_alert_actions_staff_select on public.zone_alert_actions
  for select using (public.is_staff());
create policy zone_alert_actions_staff_write on public.zone_alert_actions
  for all using (public.is_staff()) with check (public.is_staff());

-- Sensible defaults: yellow = passive, orange adds on-call push, red
-- adds SMS + auto-call. Clinic can adjust in the editor.
insert into public.zone_alert_actions
  (alert_level, email_clinic, inapp_to_all,
   push_to_oncall, sms_oncall, autocall_oncall)
values
  ('yellow', true, true, false, false, false),
  ('orange', true, true, true,  false, false),
  ('red',    true, true, true,  true,  true)
on conflict (alert_level) do nothing;

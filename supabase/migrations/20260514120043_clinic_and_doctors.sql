-- Settings → Clinic & Doctors (spec §6). Extends clinic_profile, adds the
-- doctors table + photo storage, re-creates partner_facilities with a
-- richer schema, and adds ordering/soft-delete columns to message
-- templates and content items.

-- ── clinic_profile: extra fields ─────────────────────────────────────────
alter table public.clinic_profile
  add column abn text,
  add column email text,
  add column website text;

-- Enforce the single-row invariant at the DB level: a unique index on a
-- constant expression permits exactly one row, so a stray INSERT fails
-- and the editor must UPDATE the existing row.
create unique index clinic_profile_singleton on public.clinic_profile ((true));

-- ── doctors ──────────────────────────────────────────────────────────────
-- The clinic team directory. Soft-delete only (active flag) so historical
-- audit rows and messages keep their name + role labels.
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null
    check (role in ('Surgeon', 'Optometrist', 'Nurse', 'Reception')),
  email text,
  phone text,
  photo_url text,
  bio text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.doctors
for each row execute function public.set_updated_at();

alter table public.doctors enable row level security;

create policy doctors_select on public.doctors
  for select using (auth.uid() is not null);
create policy doctors_staff_write on public.doctors
  for all using (public.is_staff()) with check (public.is_staff());

-- Doctor photos are clinic-team headshots (not patient PII) — a public
-- bucket, so photo_url can be a plain public URL. Staff upload only.
insert into storage.buckets (id, name, public)
values ('doctor-photos', 'doctor-photos', true)
on conflict (id) do nothing;

create policy "staff_upload_doctor_photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'doctor-photos' and public.is_staff());
create policy "staff_update_doctor_photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'doctor-photos' and public.is_staff());

-- ── partner_facilities (re-created) ──────────────────────────────────────
-- Originally added in migration 39, dropped in 41 when the feedback
-- hospital dropdown was removed. Re-created here with a richer schema for
-- the Clinic & Doctors → Partner facilities tab.
create table public.partner_facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  liaison_email text,
  liaison_phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.partner_facilities
for each row execute function public.set_updated_at();

alter table public.partner_facilities enable row level security;

create policy partner_facilities_select on public.partner_facilities
  for select using (auth.uid() is not null);
create policy partner_facilities_staff_write on public.partner_facilities
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.partner_facilities (name, address) values
  ('South Brisbane Day Hospital', '40 Hope St, South Brisbane QLD 4101'),
  ('Mater Day Surgery', 'Raymond Tce, South Brisbane QLD 4101'),
  ('Brisbane Eye Hospital', '120 Wickham Tce, Spring Hill QLD 4000');

-- ── message_templates: ordering + soft-delete ────────────────────────────
alter table public.message_templates
  add column order_index integer not null default 0,
  add column active boolean not null default true;

-- ── content_items: soft-delete + friendly days_range ─────────────────────
-- days_range was an unused int4range; the editor wants a friendly string
-- ("1-7", "0", "30+"), so re-add it as text.
alter table public.content_items
  add column active boolean not null default true;
alter table public.content_items drop column days_range;
alter table public.content_items add column days_range text;

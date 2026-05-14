-- Surgical documents + patient/staff messaging.

-- Documents (op reports, scripts, receipts, etc.). Watermarked at view time
-- per CLAUDE.md; storage_path points into Supabase Storage with signed URLs.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  category text not null,
  filename text not null,
  storage_path text not null,
  uploaded_by uuid references public.staff_users(id),
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create index documents_patient_id_idx on public.documents (patient_id);

-- One message thread per patient. Staff assignment is optional.
create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  assigned_staff_id uuid references public.staff_users(id),
  status public.message_thread_status not null default 'open',
  last_message_at timestamptz,
  unread_for_patient integer not null default 0,
  unread_for_staff integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.message_threads
for each row execute function public.set_updated_at();

create index message_threads_assigned_staff_idx on public.message_threads (assigned_staff_id)
  where assigned_staff_id is not null;

-- Individual messages. sender_id is polymorphic (patient or staff) — no FK
-- because Postgres doesn't support polymorphic refs; sender_type
-- discriminates and app code is responsible for resolving sender_id to the
-- right table.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_type public.message_sender_type not null,
  sender_id uuid not null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

create index messages_thread_id_idx on public.messages (thread_id);
create index messages_sent_at_idx on public.messages (sent_at);

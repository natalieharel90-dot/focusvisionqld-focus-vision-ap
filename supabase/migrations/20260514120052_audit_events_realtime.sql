-- Enable Supabase Realtime on audit_events so the home dashboard's
-- activity feed receives new events live. Publication change only — no
-- table or column change. RLS still gates delivery (staff-only select).
alter publication supabase_realtime add table public.audit_events;

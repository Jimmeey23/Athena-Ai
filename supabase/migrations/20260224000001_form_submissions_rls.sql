-- Ensure form_submissions table exists with correct columns
create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id text not null,
  form_title text not null,
  data jsonb not null default '{}'::jsonb,
  utm_params jsonb,
  submitted_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);
-- Enable RLS
alter table public.form_submissions enable row level security;
-- Allow anyone (including anon/public from deployed forms) to INSERT submissions
drop policy if exists "Allow anonymous inserts" on public.form_submissions;
create policy "Allow anonymous inserts"
  on public.form_submissions
  for insert
  to anon, authenticated
  with check (true);
-- Allow authenticated users (admins in the builder) to read all submissions
drop policy if exists "Allow authenticated reads" on public.form_submissions;
create policy "Allow authenticated reads"
  on public.form_submissions
  for select
  to authenticated
  using (true);
-- Grant usage to anon and authenticated roles
grant usage on schema public to anon, authenticated;
grant insert on public.form_submissions to anon, authenticated;
grant select on public.form_submissions to authenticated;

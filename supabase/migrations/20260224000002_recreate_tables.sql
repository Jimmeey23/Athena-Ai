-- Ensure form builder persistence tables exist without deleting live data.

-- 1. Forms table stores the complete builder config JSON for every form.
create table if not exists public.forms (
  id text primary key,
  title text not null default '',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 2. Submission table stores public form responses.
create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id text not null,
  form_title text not null default '',
  data jsonb not null default '{}'::jsonb,
  utm_params jsonb,
  submitted_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);
-- 3. Enable RLS on both tables.
alter table public.forms enable row level security;
alter table public.form_submissions enable row level security;
-- 4. Forms policies.
drop policy if exists "forms: authenticated full access" on public.forms;
create policy "forms: authenticated full access"
  on public.forms
  for all
  to authenticated
  using (true)
  with check (true);
drop policy if exists "forms: anon read" on public.forms;
create policy "forms: anon read"
  on public.forms
  for select
  to anon
  using (true);
-- 5. Submission policies.
drop policy if exists "submissions: public insert" on public.form_submissions;
create policy "submissions: public insert"
  on public.form_submissions
  for insert
  to anon, authenticated
  with check (true);
drop policy if exists "submissions: authenticated read" on public.form_submissions;
create policy "submissions: authenticated read"
  on public.form_submissions
  for select
  to authenticated
  using (true);
drop policy if exists "submissions: authenticated delete" on public.form_submissions;
create policy "submissions: authenticated delete"
  on public.form_submissions
  for delete
  to authenticated
  using (true);
-- 6. Grant schema + table permissions explicitly.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.forms to authenticated;
grant select on public.forms to anon;
grant insert on public.form_submissions to anon;
grant select, insert, update, delete on public.form_submissions to authenticated;

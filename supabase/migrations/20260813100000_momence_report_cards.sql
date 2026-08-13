-- Persisted Momence report cards for the Ops dashboard.
-- Lets admins save a report configuration once and re-run it, instead of
-- re-typing report JSON into the ad-hoc Operations console every time.

create table if not exists public.momence_report_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  parameters jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_status text,
  last_result jsonb,
  last_error text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists momence_report_cards_created_at_idx
on public.momence_report_cards (created_at desc);

create or replace function public.set_momence_report_cards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists momence_report_cards_set_updated_at on public.momence_report_cards;
create trigger momence_report_cards_set_updated_at
before update on public.momence_report_cards
for each row execute function public.set_momence_report_cards_updated_at();

alter table public.momence_report_cards enable row level security;

drop policy if exists "Momence report cards are readable by authenticated users" on public.momence_report_cards;
create policy "Momence report cards are readable by authenticated users"
on public.momence_report_cards for select
to authenticated
using (true);

drop policy if exists "Admins can manage momence report cards" on public.momence_report_cards;
create policy "Admins can manage momence report cards"
on public.momence_report_cards for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

notify pgrst, 'reload schema';

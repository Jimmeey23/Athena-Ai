-- Inbound Momence webhook event log.
-- Every verified webhook delivery is recorded here, keyed by Momence's
-- x-webhook-request-id, so retried deliveries don't get double-processed
-- (and so we auto-created tickets can be traced back to their source event).

create table if not exists public.momence_webhook_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  ticket_id text,
  received_at timestamptz not null default now()
);

create index if not exists momence_webhook_events_received_at_idx
on public.momence_webhook_events (received_at desc);

create index if not exists momence_webhook_events_event_type_idx
on public.momence_webhook_events (event_type);

alter table public.momence_webhook_events enable row level security;

drop policy if exists "Admins can read momence webhook events" on public.momence_webhook_events;
create policy "Admins can read momence webhook events"
on public.momence_webhook_events for select
to authenticated
using (public.current_user_role() = 'admin');

notify pgrst, 'reload schema';

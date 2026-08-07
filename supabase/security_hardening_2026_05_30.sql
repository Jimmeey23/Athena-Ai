-- Security hardening for ticket auth, profile roles, ticket events, and attachments.
-- Safe to re-run after the base ticketing schema/access-level SQL.

create or replace function public.enforce_ticket_status_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'Closed' and new.status is distinct from 'Closed' then
    raise exception 'Closed tickets cannot be reopened.'
      using errcode = '42501';
  end if;

  if old.status is distinct from new.status
     and not public.can_update_ticket_status(old.assigned_to) then
    raise exception 'Only the assigned ticket owner or an admin can change ticket status.'
      using errcode = '42501';
  end if;

  if old.assigned_to is distinct from new.assigned_to
     and public.current_user_role() <> 'admin'
     and not public.can_update_ticket_status(old.assigned_to) then
    raise exception 'Only the assigned ticket owner or an admin can reassign tickets.'
      using errcode = '42501';
  end if;

  if old.priority is distinct from new.priority
     and public.current_user_role() <> 'admin'
     and not public.can_update_ticket_status(old.assigned_to) then
    raise exception 'Only the assigned ticket owner or an admin can change ticket priority.'
      using errcode = '42501';
  end if;

  if old.status is distinct from new.status then
    if btrim(coalesce(new.metadata #>> '{latestResolution,reason}', '')) = '' then
      raise exception 'Status changes require a reason.'
        using errcode = '23514';
    end if;

    if btrim(coalesce(new.metadata #>> '{latestResolution,actionTaken}', '')) = '' then
      raise exception 'Status changes require actions taken by the owner.'
        using errcode = '23514';
    end if;

    if btrim(coalesce(new.metadata #>> '{latestResolution,actionDate}', '')) = '' then
      raise exception 'Status changes require the action date.'
        using errcode = '23514';
    end if;

    if new.status in ('Resolved', 'Closed')
       and btrim(coalesce(new.metadata #>> '{latestResolution,resolutionSummary}', '')) = '' then
      raise exception 'Resolved or closed tickets require a resolution summary.'
        using errcode = '23514';
    end if;

    if new.status in ('Resolved', 'Closed')
       and btrim(coalesce(new.metadata #>> '{latestResolution,outcome}', '')) = '' then
      raise exception 'Resolved or closed tickets require the final member or operational outcome.'
        using errcode = '23514';
    end if;

    if new.status = 'Closed'
       and btrim(coalesce(new.metadata #>> '{latestResolution,closedAt}', new.metadata ->> 'closedAt', '')) = '' then
      new.metadata = jsonb_set(
        jsonb_set(new.metadata, '{closedAt}', to_jsonb(now()), true),
        '{latestResolution,closedAt}', to_jsonb(now()), true
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    public.resolve_access_role(new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "Authenticated users can create ticket events" on public.ticket_events;
create policy "Authenticated users can create ticket events"
on public.ticket_events for insert
to authenticated
with check (
  (created_by is null or created_by = auth.uid())
  and exists (
    select 1
    from public.tickets t
    where t.id = ticket_events.ticket_id
      and public.can_access_ticket(t.created_by, t.assigned_to, t.team)
  )
);

insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated users can read ticket attachments" on storage.objects;
create policy "Authenticated users can read ticket attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.tickets t
    where t.id = split_part(storage.objects.name, '/', 1)
      and public.can_access_ticket(t.created_by, t.assigned_to, t.team)
  )
);

drop policy if exists "Authenticated users can upload ticket attachments" on storage.objects;
create policy "Authenticated users can upload ticket attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.tickets t
    where t.id = split_part(storage.objects.name, '/', 1)
      and public.can_access_ticket(t.created_by, t.assigned_to, t.team)
  )
);

drop policy if exists "Authenticated users can update ticket attachments" on storage.objects;
create policy "Authenticated users can update ticket attachments"
on storage.objects for update
to authenticated
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.tickets t
    where t.id = split_part(storage.objects.name, '/', 1)
      and public.can_access_ticket(t.created_by, t.assigned_to, t.team)
  )
)
with check (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.tickets t
    where t.id = split_part(storage.objects.name, '/', 1)
      and public.can_access_ticket(t.created_by, t.assigned_to, t.team)
  )
);

drop policy if exists "Authenticated users can delete ticket attachments" on storage.objects;
create policy "Authenticated users can delete ticket attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.tickets t
    where t.id = split_part(storage.objects.name, '/', 1)
      and public.can_access_ticket(t.created_by, t.assigned_to, t.team)
  )
);

notify pgrst, 'reload schema';

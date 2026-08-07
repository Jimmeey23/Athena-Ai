-- Resolver/status fields are editable only by the assigned ticket owner or
-- that owner's immediate supervisor. Admin role alone is not sufficient.

create or replace function public.current_user_managed_assignment_keys()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  assignment_keys text[] := public.current_user_assignment_keys();
  managed_keys text[] := '{}';
begin
  if to_regclass('public.employees') is not null then
    execute $managed_query$
      select coalesce(array_agg(distinct value) filter (where value <> ''), '{}')
      from (
        select lower(coalesce(name, '')) as value
        from public.employees
        where lower(coalesce(manager, '')) = any($1)
        union
        select lower(coalesce(email, '')) as value
        from public.employees
        where lower(coalesce(manager, '')) = any($1)
      ) managed
    $managed_query$
    using assignment_keys
    into managed_keys;
  end if;

  return managed_keys;
end;
$$;

create or replace function public.can_update_ticket_status(ticket_assigned_to text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(ticket_assigned_to, '')) = any(public.current_user_assignment_keys())
    or lower(coalesce(ticket_assigned_to, '')) = any(public.current_user_managed_assignment_keys());
$$;

revoke all on function public.current_user_managed_assignment_keys() from public, anon;
grant execute on function public.current_user_managed_assignment_keys() to authenticated;

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
    raise exception 'Only the assigned ticket owner or their immediate supervisor can change ticket status.'
      using errcode = '42501';
  end if;

  if old.assigned_to is distinct from new.assigned_to
     and not public.can_update_ticket_status(old.assigned_to) then
    raise exception 'Only the assigned ticket owner or their immediate supervisor can reassign tickets.'
      using errcode = '42501';
  end if;

  if old.priority is distinct from new.priority
     and not public.can_update_ticket_status(old.assigned_to) then
    raise exception 'Only the assigned ticket owner or their immediate supervisor can change ticket priority.'
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

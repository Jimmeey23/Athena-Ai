-- Athena access levels: admin, manager, and executive
-- Run this in Supabase SQL editor after the base ticketing schema.

alter table public.profiles add column if not exists role text;

alter table public.tickets add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.tickets add column if not exists assigned_to text not null default 'Unassigned';

create or replace function public.resolve_access_role(user_email text, user_full_name text default null)
returns text
language sql
immutable
as $$
  select case
    when split_part(lower(coalesce(user_email, '')), '@', 2) = 'physique57india.com' then 'admin'
    when split_part(
      regexp_replace(
        lower(coalesce(nullif(btrim(user_full_name), ''), split_part(coalesce(user_email, ''), '@', 1))),
        '[._-]+',
        ' ',
        'g'
      ),
      ' ',
      1
    ) in ('pushyank', 'shifa', 'mrigakshi', 'vivaran') then 'manager'
    when split_part(lower(coalesce(user_email, '')), '@', 2) in ('physique57mumbai.com', 'physique57bengaluru.com') then 'executive'
    else 'executive'
  end;
$$;

update public.profiles p
set role = public.resolve_access_role(
  coalesce(p.email, u.email),
  coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
)
from auth.users u
where u.id = p.id
  and (p.role is null or p.role not in ('admin', 'manager', 'executive', 'support'));

update public.profiles
set role = public.resolve_access_role(email, full_name)
where role is null or role = 'support' or role not in ('admin', 'manager', 'executive');

alter table public.profiles alter column role set default 'executive';
alter table public.profiles alter column role set not null;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'manager', 'executive'));

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.resolve_access_role(
    coalesce((select email from public.profiles where id = auth.uid()), (select email from auth.users where id = auth.uid())),
    coalesce(
      (select full_name from public.profiles where id = auth.uid()),
      (select raw_user_meta_data ->> 'full_name' from auth.users where id = auth.uid()),
      (select raw_user_meta_data ->> 'name' from auth.users where id = auth.uid())
    )
  );
$$;

create or replace function public.current_user_assignment_keys()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base_keys text[];
  employee_keys text[] := '{}';
begin
  select coalesce(array_agg(distinct value) filter (where value <> ''), '{}')
  into base_keys
  from (
    select lower(coalesce((select email from public.profiles where id = auth.uid()), '')) as value
    union
    select lower(coalesce((select full_name from public.profiles where id = auth.uid()), ''))
    union
    select lower(coalesce((select raw_user_meta_data ->> 'full_name' from auth.users where id = auth.uid()), ''))
    union
    select lower(coalesce((select raw_user_meta_data ->> 'name' from auth.users where id = auth.uid()), ''))
    union
    select lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  ) keys;

  if to_regclass('public.employees') is not null then
    execute $employee_query$
      select coalesce(array_agg(distinct value) filter (where value <> ''), '{}')
      from (
        select lower(coalesce(name, '')) as value
        from public.employees
        where lower(coalesce(email, '')) = any($1)
           or lower(coalesce(name, '')) = any($1)
        union
        select lower(coalesce(email, '')) as value
        from public.employees
        where lower(coalesce(email, '')) = any($1)
           or lower(coalesce(name, '')) = any($1)
      ) employee_keys
    $employee_query$
    using base_keys
    into employee_keys;
  end if;

  return (
    select coalesce(array_agg(distinct value) filter (where value <> ''), '{}')
    from unnest(base_keys || employee_keys) value
  );
end;
$$;

create or replace function public.current_user_departments()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  assignment_keys text[] := public.current_user_assignment_keys();
  departments text[] := '{}';
begin
  if to_regclass('public.employees') is not null then
    execute $department_query$
      select coalesce(array_agg(distinct lower(coalesce(department, ''))) filter (where coalesce(department, '') <> ''), '{}')
      from public.employees
      where lower(coalesce(email, '')) = any($1)
         or lower(coalesce(name, '')) = any($1)
         or lower(coalesce(manager, '')) = any($1)
    $department_query$
    using assignment_keys
    into departments;
  end if;

  return (
    select coalesce(array_agg(distinct value) filter (where value <> ''), '{}')
    from unnest(departments || array[lower(coalesce((select team from public.profiles where id = auth.uid()), ''))]) value
  );
end;
$$;

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

create or replace function public.profile_matches_assignment_keys(profile_id uuid, assignment_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.id = profile_id
      and (
        lower(coalesce(p.email, u.email, '')) = any(assignment_keys)
        or lower(coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')) = any(assignment_keys)
      )
  );
$$;

create or replace function public.can_access_ticket(ticket_created_by uuid, ticket_assigned_to text, ticket_team text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_role() = 'admin'
    or ticket_created_by = auth.uid()
    or lower(coalesce(ticket_assigned_to, '')) = any(public.current_user_assignment_keys())
    or (
      public.current_user_role() = 'manager'
      and (
        coalesce(array_length(public.current_user_departments(), 1), 0) = 0
        or lower(coalesce(ticket_team, '')) = any(public.current_user_departments())
      )
      and lower(coalesce(ticket_assigned_to, '')) = any(public.current_user_managed_assignment_keys())
    )
    or (
      public.current_user_role() = 'manager'
      and (
        coalesce(array_length(public.current_user_departments(), 1), 0) = 0
        or lower(coalesce(ticket_team, '')) = any(public.current_user_departments())
      )
      and public.profile_matches_assignment_keys(ticket_created_by, public.current_user_managed_assignment_keys())
    );
$$;

create or replace function public.can_access_ticket(ticket_created_by uuid, ticket_assigned_to text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_ticket(ticket_created_by, ticket_assigned_to, null);
$$;

create or replace function public.can_update_ticket_status(ticket_assigned_to text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_role() = 'admin'
    or lower(coalesce(ticket_assigned_to, '')) = any(public.current_user_assignment_keys());
$$;

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

alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;

drop trigger if exists tickets_enforce_status_owner on public.tickets;
create trigger tickets_enforce_status_owner
before update on public.tickets
for each row execute function public.enforce_ticket_status_owner();

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Profiles are readable by owner or admins" on public.profiles;
create policy "Profiles are readable by owner, managers, or admins"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() = 'admin'
  or (
    public.current_user_role() = 'manager'
    and lower(coalesce(team, '')) = any(public.current_user_departments())
  )
);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role = public.current_user_role());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Tickets are readable by authenticated users" on public.tickets;
drop policy if exists "Tickets are readable by role access" on public.tickets;
create policy "Tickets are readable by role access"
on public.tickets for select
to authenticated
using (public.can_access_ticket(created_by, assigned_to, team));

drop policy if exists "Authenticated users can create tickets" on public.tickets;
create policy "Authenticated users can create tickets"
on public.tickets for insert
to authenticated
with check (created_by is null or created_by = auth.uid());

drop policy if exists "Authenticated users can update tickets" on public.tickets;
drop policy if exists "Authenticated users can update accessible tickets" on public.tickets;
create policy "Authenticated users can update accessible tickets"
on public.tickets for update
to authenticated
using (public.can_access_ticket(created_by, assigned_to, team))
with check (auth.uid() is not null);

drop policy if exists "Authenticated users can delete tickets" on public.tickets;
drop policy if exists "Admins and creators can delete tickets" on public.tickets;
create policy "Admins and creators can delete tickets"
on public.tickets for delete
to authenticated
using (public.current_user_role() = 'admin' or created_by = auth.uid());

drop policy if exists "Ticket events are readable by authenticated users" on public.ticket_events;
drop policy if exists "Ticket events are readable by ticket access" on public.ticket_events;
create policy "Ticket events are readable by ticket access"
on public.ticket_events for select
to authenticated
using (
  exists (
    select 1
    from public.tickets t
    where t.id = ticket_events.ticket_id
      and public.can_access_ticket(t.created_by, t.assigned_to, t.team)
  )
);

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

-- Promote a user to admin:
-- Users on physique57india.com resolve to admin automatically.

-- Named managers resolve by first name: Pushyank, Shifa, Mrigakshi, Vivaran.

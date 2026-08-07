-- Repair ticket visibility for executive and manager users.
-- Executives can read tickets they created or tickets assigned to their employee record.
-- Managers can also read tickets made by or assigned to managed team members inside their department scope.
-- Admin users continue to read every ticket.

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

create or replace function public.can_access_ticket(ticket_created_by uuid, ticket_assigned_to text, ticket_team text default null)
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

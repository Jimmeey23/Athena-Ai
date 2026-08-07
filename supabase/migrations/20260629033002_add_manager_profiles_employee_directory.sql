-- Add/update manager-level profiles and employee directory rows for the
-- Physique 57 India leadership team.

alter table public.employees add column if not exists birthday_date date;

with manager_profiles (
  email,
  first_name,
  last_name,
  full_name,
  birthday_date,
  designation,
  department,
  location,
  reporting_manager
) as (
  values
    ('mitali@physique57india.com', 'Mitali', 'Kumar', 'Mitali Kumar', date '1988-11-17', 'Chief Operations Officer', 'Management', 'India', 'Mallika Parekh'),
    ('jimmeey@physique57india.com', 'Jimmeey', 'Gondaa', 'Jimmeey Gondaa', date '1990-03-23', 'Head of Sales & Client Servicing', 'Sales & Client Servicing', 'India', 'Mitali Kumar'),
    ('vivaran@physique57mumbai.com', 'Vivaran', 'Dhasmana', 'Vivaran Dhasmana', date '1995-01-26', 'Head Trainer', 'Training', 'Mumbai', 'Anisha Shah'),
    ('mrigakshi@physique57mumbai.com', 'Mrigakshi', 'Jaiswal', 'Mrigakshi Jaiswal', date '1987-10-19', 'Head Trainer', 'Training', 'Mumbai', 'Anisha Shah'),
    ('pushyank@physique57bengaluru.com', 'Pushyank', 'Nahar', 'Pushyank Nahar', date '1994-11-29', 'Head Trainer', 'Training', 'Bengaluru', 'Anisha Shah'),
    ('saachi.s@physique57bengaluru.com', 'Saachi', 'Shetty Jr', 'Saachi Shetty Jr', date '2000-12-29', 'Marketing Lead', 'Marketing', 'Bengaluru', 'Shifa Ali'),
    ('anisha@physique57india.com', 'Anisha', 'Shah', 'Anisha Shah', date '1986-12-11', 'Master Trainer', 'Training', 'India', 'Mallika Parekh'),
    ('saachi@physique57india.com', 'Saachi', 'Shetty', 'Saachi Shetty', date '1992-01-18', 'Ops Manager', 'Operations', 'India', 'Mitali Kumar'),
    ('mallika@physique57india.com', 'Mallika', 'Parekh', 'Mallika Parekh', date '2026-12-06', 'Owner', 'Management', 'India', 'God'),
    ('shifa@physique57bengaluru.com', 'Shifa', 'Ali', 'Shifa Ali', date '1992-09-22', 'Regional head of Ops - South', 'Operations', 'Bengaluru', 'Mitali Kumar')
)
insert into public.employees (
  id,
  name,
  email,
  department,
  role,
  location,
  manager,
  active,
  birthday_date,
  updated_at
)
select
  regexp_replace(lower(email), '[^a-z0-9]+', '-', 'g'),
  full_name,
  email,
  department,
  designation,
  location,
  reporting_manager,
  true,
  birthday_date,
  now()
from manager_profiles
on conflict (id) do update
set
  name = excluded.name,
  email = excluded.email,
  department = excluded.department,
  role = excluded.role,
  location = excluded.location,
  manager = excluded.manager,
  active = excluded.active,
  birthday_date = excluded.birthday_date,
  updated_at = now();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager', 'executive')
    ),
    public.resolve_access_role(
      coalesce((select email from public.profiles where id = auth.uid()), (select email from auth.users where id = auth.uid())),
      coalesce(
        (select full_name from public.profiles where id = auth.uid()),
        (select raw_user_meta_data ->> 'full_name' from auth.users where id = auth.uid()),
        (select raw_user_meta_data ->> 'name' from auth.users where id = auth.uid())
      )
    )
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  manager_emails constant text[] := array[
    'mitali@physique57india.com',
    'jimmeey@physique57india.com',
    'vivaran@physique57mumbai.com',
    'mrigakshi@physique57mumbai.com',
    'pushyank@physique57bengaluru.com',
    'saachi.s@physique57bengaluru.com',
    'anisha@physique57india.com',
    'saachi@physique57india.com',
    'mallika@physique57india.com',
    'shifa@physique57bengaluru.com'
  ];
  resolved_full_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );
  resolved_role text;
begin
  resolved_role := case
    when lower(coalesce(new.email, '')) = any(manager_emails) then 'manager'
    else public.resolve_access_role(new.email, resolved_full_name)
  end;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, resolved_full_name, resolved_role)
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = case
      when lower(coalesce(excluded.email, '')) = any(manager_emails) then 'manager'
      else coalesce(public.profiles.role, excluded.role)
    end;

  return new;
end;
$$;

with manager_profiles (email, full_name, department) as (
  values
    ('mitali@physique57india.com', 'Mitali Kumar', 'Management'),
    ('jimmeey@physique57india.com', 'Jimmeey Gondaa', 'Sales & Client Servicing'),
    ('vivaran@physique57mumbai.com', 'Vivaran Dhasmana', 'Training'),
    ('mrigakshi@physique57mumbai.com', 'Mrigakshi Jaiswal', 'Training'),
    ('pushyank@physique57bengaluru.com', 'Pushyank Nahar', 'Training'),
    ('saachi.s@physique57bengaluru.com', 'Saachi Shetty Jr', 'Marketing'),
    ('anisha@physique57india.com', 'Anisha Shah', 'Training'),
    ('saachi@physique57india.com', 'Saachi Shetty', 'Operations'),
    ('mallika@physique57india.com', 'Mallika Parekh', 'Management'),
    ('shifa@physique57bengaluru.com', 'Shifa Ali', 'Operations')
)
update public.profiles p
set
  email = coalesce(p.email, u.email, manager_profiles.email),
  full_name = manager_profiles.full_name,
  team = manager_profiles.department,
  role = 'manager',
  updated_at = now()
from manager_profiles
left join auth.users u on lower(u.email) = manager_profiles.email
where p.id = u.id
  or lower(coalesce(p.email, '')) = manager_profiles.email;

-- jimmeey@physique57india.com is on the admin domain (physique57india.com) but was
-- force-set to 'manager' by 20260629033002_add_manager_profiles_employee_directory.sql,
-- which hardcoded that email into its manager_emails list. That override made both the
-- client (isAdmin check) and current_user_role() treat him as a manager, hiding admin-only
-- UI (e.g. trainer review delete) and blocking admin-only RLS policies server-side too.
-- Restore the correct admin role and stop forcing 'manager' for this email going forward.

update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = 'jimmeey@physique57india.com';

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  manager_emails constant text[] := array[
    'mitali@physique57india.com',
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

notify pgrst, 'reload schema';

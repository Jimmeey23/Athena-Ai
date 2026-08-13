create or replace function public.debug_list_can_update_overloads()
returns table(identity_args text, definition text)
language sql
security definer
set search_path = public
as $$
  select pg_get_function_identity_arguments(p.oid), pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'can_update_ticket_status';
$$;

grant execute on function public.debug_list_can_update_overloads() to authenticated, anon;

-- Ticket attachment storage bucket + policies.
-- Run after:
--   1) supabase/ticketing_schema.sql
--   2) supabase/access_levels.sql
--
-- Safe to re-run.

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

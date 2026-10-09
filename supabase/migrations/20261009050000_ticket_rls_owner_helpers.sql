begin;

create or replace function public.current_user_owns_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and t.owner_user_id = (select auth.uid())
  );
$$;

revoke all on function public.current_user_owns_ticket(uuid)
  from public, anon;
grant execute on function public.current_user_owns_ticket(uuid)
  to authenticated, service_role;

drop policy if exists ticket_messages_owner_read_public
  on public.ticket_messages;
create policy ticket_messages_owner_read_public on public.ticket_messages
  for select to authenticated
  using (
    not is_internal
    and public.current_user_owns_ticket(ticket_id)
  );

drop policy if exists ticket_messages_owner_reply
  on public.ticket_messages;
create policy ticket_messages_owner_reply on public.ticket_messages
  for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and not is_internal
    and public.current_user_owns_ticket(ticket_id)
  );

commit;
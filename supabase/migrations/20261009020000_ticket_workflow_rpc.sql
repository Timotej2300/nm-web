begin;

create or replace function public.create_player_ticket(
  p_owner_user_id uuid,
  p_category text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ticket_id uuid;
begin
  if length(trim(p_category)) not between 1 and 60
     or length(trim(p_subject)) not between 4 and 180
     or length(trim(p_body)) not between 1 and 12000 then
    raise exception using errcode = '22023', message = 'Invalid ticket fields';
  end if;

  insert into public.tickets (owner_user_id, category, subject)
  values (p_owner_user_id, trim(p_category), trim(p_subject))
  returning id into ticket_id;

  insert into public.ticket_messages (ticket_id, author_user_id, body)
  values (ticket_id, p_owner_user_id, trim(p_body));

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_owner_user_id, 'ticket.create', 'ticket', ticket_id::text, 'success',
     jsonb_build_object('category', trim(p_category)));
  return ticket_id;
end;
$$;

create or replace function public.reply_to_player_ticket(
  p_owner_user_id uuid,
  p_ticket_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_status text;
begin
  if length(trim(p_body)) not between 1 and 12000 then
    raise exception using errcode = '22023', message = 'Invalid ticket message';
  end if;

  select status into current_status
  from public.tickets
  where id = p_ticket_id and owner_user_id = p_owner_user_id
  for update;

  if not found or current_status in ('resolved', 'closed') then
    raise exception using errcode = 'P0001', message = 'Ticket unavailable';
  end if;

  insert into public.ticket_messages (ticket_id, author_user_id, body)
  values (p_ticket_id, p_owner_user_id, trim(p_body));

  update public.tickets
  set status = 'open', updated_at = now()
  where id = p_ticket_id;
end;
$$;

revoke all on function public.create_player_ticket(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.reply_to_player_ticket(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_player_ticket(uuid, text, text, text)
  to service_role;
grant execute on function public.reply_to_player_ticket(uuid, uuid, text)
  to service_role;

commit;
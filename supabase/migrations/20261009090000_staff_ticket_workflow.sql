begin;

create or replace function public.manage_player_ticket(
  p_actor_user_id uuid,
  p_ticket_id uuid,
  p_operation text,
  p_status text default null,
  p_assignee_user_id uuid default null,
  p_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_ticket public.tickets%rowtype;
  next_status text;
  next_assignee uuid;
  audit_action text;
begin
  if p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'Actor is required';
  end if;

  select * into current_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Ticket not found';
  end if;

  next_status := current_ticket.status;
  next_assignee := current_ticket.assigned_to;

  if p_operation = 'status' then
    if p_status not in ('open', 'waiting', 'in_progress', 'resolved', 'closed') then
      raise exception using errcode = '22023', message = 'Invalid ticket status';
    end if;
    next_status := p_status;
    update public.tickets
    set status = next_status,
        closed_at = case when next_status in ('resolved', 'closed') then now() else null end,
        updated_at = now()
    where id = p_ticket_id;
    audit_action := 'ticket.status';
  elsif p_operation = 'assign' then
    if p_assignee_user_id is not null and p_assignee_user_id <> p_actor_user_id then
      raise exception using errcode = '22023', message = 'Staff may only self-assign';
    end if;
    next_assignee := p_assignee_user_id;
    update public.tickets
    set assigned_to = next_assignee, updated_at = now()
    where id = p_ticket_id;
    audit_action := case when next_assignee is null then 'ticket.unassign' else 'ticket.assign' end;
  elsif p_operation in ('reply', 'internal_note') then
    if p_body is null or length(trim(p_body)) not between 1 and 12000 then
      raise exception using errcode = '22023', message = 'Invalid ticket message';
    end if;
    insert into public.ticket_messages (ticket_id, author_user_id, body, is_internal)
    values (p_ticket_id, p_actor_user_id, trim(p_body), p_operation = 'internal_note');
    if p_operation = 'reply' then
      next_status := 'waiting';
      update public.tickets
      set status = next_status, closed_at = null, updated_at = now()
      where id = p_ticket_id;
      audit_action := 'ticket.staff_reply';
    else
      update public.tickets set updated_at = now() where id = p_ticket_id;
      audit_action := 'ticket.internal_note';
    end if;
  else
    raise exception using errcode = '22023', message = 'Invalid ticket operation';
  end if;

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_actor_user_id, audit_action, 'ticket', p_ticket_id::text, 'success',
     jsonb_build_object(
       'status_before', current_ticket.status,
       'status_after', next_status,
       'assignee_before', current_ticket.assigned_to,
       'assignee_after', next_assignee
     ));

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'status', next_status,
    'assigned_to', next_assignee
  );
end;
$$;

revoke all on function public.manage_player_ticket(uuid, uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.manage_player_ticket(uuid, uuid, text, text, uuid, text)
  to service_role;

commit;
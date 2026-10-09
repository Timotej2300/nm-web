begin;

create or replace function public.moderate_forum_report(
  p_actor_user_id uuid,
  p_report_id uuid,
  p_report_status text,
  p_content_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_report public.content_reports%rowtype;
begin
  if p_actor_user_id is null
     or p_report_status is null
     or p_report_status not in ('new', 'reviewing', 'resolved', 'dismissed')
     or p_content_action is null
     or p_content_action not in ('none', 'hide', 'restore', 'lock', 'unlock') then
    raise exception using errcode = '22023', message = 'Invalid moderation action';
  end if;

  select * into current_report
  from public.content_reports
  where id = p_report_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Report not found';
  end if;

  if p_content_action in ('lock', 'unlock')
     and current_report.target_type <> 'forum_topic' then
    raise exception using errcode = '22023', message = 'Only topics can be locked';
  end if;
  if p_content_action <> 'none' and current_report.target_type = 'profile' then
    raise exception using errcode = '22023', message = 'Profile reports require manual review';
  end if;

  if current_report.target_type = 'forum_topic' then
    if p_content_action = 'hide' then
      update public.forum_topics set status = 'hidden', updated_at = now()
      where id = current_report.target_id and status in ('open', 'locked');
    elsif p_content_action = 'restore' then
      update public.forum_topics set status = 'open', updated_at = now()
      where id = current_report.target_id and status = 'hidden';
    elsif p_content_action = 'lock' then
      update public.forum_topics set status = 'locked', updated_at = now()
      where id = current_report.target_id and status = 'open';
    elsif p_content_action = 'unlock' then
      update public.forum_topics set status = 'open', updated_at = now()
      where id = current_report.target_id and status = 'locked';
    end if;
    if p_content_action <> 'none' and not found then
      raise exception using errcode = 'P0001', message = 'Topic state does not allow this action';
    end if;
  elsif current_report.target_type = 'forum_post' then
    if p_content_action = 'hide' then
      update public.forum_posts set visibility = 'hidden', updated_at = now()
      where id = current_report.target_id and visibility = 'published';
    elsif p_content_action = 'restore' then
      update public.forum_posts p set visibility = 'published', updated_at = now()
      where p.id = current_report.target_id and p.visibility = 'hidden'
        and exists (
          select 1 from public.forum_topics t
          where t.id = p.topic_id and t.status in ('open', 'locked')
        );
    end if;
    if p_content_action in ('hide', 'restore') and not found then
      raise exception using errcode = 'P0001', message = 'Post state does not allow this action';
    end if;
  end if;

  update public.content_reports
  set status = p_report_status,
      resolved_at = case when p_report_status in ('resolved', 'dismissed') then now() else null end,
      resolved_by = case when p_report_status in ('resolved', 'dismissed') then p_actor_user_id else null end
  where id = p_report_id;

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_actor_user_id, 'forum.report.moderate', current_report.target_type,
     current_report.target_id::text, 'success',
     jsonb_build_object('report_id', p_report_id,
                        'report_status_before', current_report.status,
                        'report_status_after', p_report_status,
                        'content_action', p_content_action));

  return jsonb_build_object(
    'report_id', p_report_id,
    'status', p_report_status,
    'content_action', p_content_action
  );
end;
$$;

revoke all on function public.moderate_forum_report(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.moderate_forum_report(uuid, uuid, text, text)
  to service_role;

commit;
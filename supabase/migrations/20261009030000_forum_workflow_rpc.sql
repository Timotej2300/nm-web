begin;

create or replace function public.create_staff_forum_topic(
  p_author_user_id uuid,
  p_category_id uuid,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_topic_id uuid;
begin
  if length(trim(p_title)) not between 4 and 180
     or length(trim(p_body)) not between 1 and 12000
     or not exists (
       select 1 from public.forum_categories
       where id = p_category_id and is_visible
     ) then
    raise exception using errcode = '22023', message = 'Invalid topic';
  end if;

  insert into public.forum_topics (category_id, author_user_id, title)
  values (p_category_id, p_author_user_id, trim(p_title))
  returning id into new_topic_id;

  insert into public.forum_posts (topic_id, author_user_id, body_markdown)
  values (new_topic_id, p_author_user_id, trim(p_body));

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_author_user_id, 'forum.topic.create', 'forum_topic', new_topic_id::text,
     'success', jsonb_build_object('category_id', p_category_id));
  return new_topic_id;
end;
$$;

create or replace function public.reply_to_forum_topic(
  p_author_user_id uuid,
  p_topic_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_post_id uuid;
begin
  if length(trim(p_body)) not between 1 and 12000 then
    raise exception using errcode = '22023', message = 'Invalid post';
  end if;
  if not exists (
    select 1
    from public.forum_topics t
    join public.forum_categories c on c.id = t.category_id
    where t.id = p_topic_id and t.status = 'open' and c.is_visible
  ) then
    raise exception using errcode = 'P0001', message = 'Topic unavailable';
  end if;

  insert into public.forum_posts (topic_id, author_user_id, body_markdown)
  values (p_topic_id, p_author_user_id, trim(p_body))
  returning id into new_post_id;
  update public.forum_topics set updated_at = now() where id = p_topic_id;
  return new_post_id;
end;
$$;

create or replace function public.report_forum_content(
  p_reporter_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  report_id uuid;
  target_is_public boolean;
begin
  if length(trim(p_reason)) not between 3 and 1200
     or p_target_type not in ('forum_topic', 'forum_post', 'profile') then
    raise exception using errcode = '22023', message = 'Invalid report';
  end if;

  if p_target_type = 'forum_topic' then
    select exists (
      select 1 from public.forum_topics t
      join public.forum_categories c on c.id = t.category_id
      where t.id = p_target_id and t.status in ('open', 'locked') and c.is_visible
    ) into target_is_public;
  elsif p_target_type = 'forum_post' then
    select exists (
      select 1 from public.forum_posts p
      join public.forum_topics t on t.id = p.topic_id
      join public.forum_categories c on c.id = t.category_id
      where p.id = p_target_id and p.visibility = 'published'
        and t.status in ('open', 'locked') and c.is_visible
    ) into target_is_public;
  else
    select exists (
      select 1 from public.profiles
      where user_id = p_target_id and is_public
    ) into target_is_public;
  end if;

  if not target_is_public then
    raise exception using errcode = 'P0001', message = 'Target unavailable';
  end if;

  insert into public.content_reports (reporter_user_id, target_type, target_id, reason)
  values (p_reporter_user_id, p_target_type, p_target_id, trim(p_reason))
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.create_staff_forum_topic(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.reply_to_forum_topic(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.report_forum_content(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_staff_forum_topic(uuid, uuid, text, text)
  to service_role;
grant execute on function public.reply_to_forum_topic(uuid, uuid, text)
  to service_role;
grant execute on function public.report_forum_content(uuid, text, uuid, text)
  to service_role;

commit;
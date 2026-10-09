begin;

create or replace function public.save_news_article(
  p_actor_user_id uuid,
  p_id uuid,
  p_slug text,
  p_language text,
  p_title text,
  p_excerpt text,
  p_body_markdown text,
  p_status text,
  p_publish_at timestamptz,
  p_seo_title text,
  p_seo_description text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  saved_id uuid;
  audit_action text;
begin
  if p_slug !~ '^[a-z0-9][a-z0-9-]{0,119}$'
     or p_language not in ('sk', 'cs')
     or length(trim(p_title)) not between 1 and 180
     or (p_excerpt is not null and length(p_excerpt) > 500)
     or length(p_body_markdown) > 100000
     or p_status not in ('draft', 'scheduled', 'published', 'archived')
     or (p_status in ('scheduled', 'published') and p_publish_at is null)
     or (p_seo_title is not null and length(p_seo_title) > 160)
     or (p_seo_description is not null and length(p_seo_description) > 320) then
    raise exception using errcode = '22023', message = 'Invalid news article';
  end if;

  if p_id is null then
    insert into public.news_articles
      (slug, language, title, excerpt, body_markdown, status, publish_at,
       seo_title, seo_description, created_by)
    values
      (p_slug, p_language, trim(p_title), nullif(trim(p_excerpt), ''),
       p_body_markdown, p_status, p_publish_at, nullif(trim(p_seo_title), ''),
       nullif(trim(p_seo_description), ''), p_actor_user_id)
    returning id into saved_id;
    audit_action := 'news.create';
  else
    update public.news_articles
    set slug = p_slug,
        language = p_language,
        title = trim(p_title),
        excerpt = nullif(trim(p_excerpt), ''),
        body_markdown = p_body_markdown,
        status = p_status,
        publish_at = p_publish_at,
        seo_title = nullif(trim(p_seo_title), ''),
        seo_description = nullif(trim(p_seo_description), '')
    where id = p_id
    returning id into saved_id;
    if saved_id is null then
      raise exception using errcode = 'P0001', message = 'Article unavailable';
    end if;
    audit_action := 'news.update';
  end if;

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_actor_user_id, audit_action, 'news_article', saved_id::text, 'success',
     jsonb_build_object('slug', p_slug, 'language', p_language, 'status', p_status));
  return saved_id;
end;
$$;

revoke all on function public.save_news_article(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.save_news_article(
  uuid, uuid, text, text, text, text, text, text, timestamptz, text, text
) to service_role;

commit;
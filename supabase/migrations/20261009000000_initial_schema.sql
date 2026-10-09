begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minecraft_uuid uuid unique,
  minecraft_username text check (minecraft_username is null or length(minecraft_username) between 3 and 16),
  display_name text check (display_name is null or length(display_name) between 1 and 40),
  bio text check (bio is null or length(bio) <= 500),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((minecraft_uuid is null) = (minecraft_username is null))
);

create table public.minecraft_link_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 8),
  request_id uuid not null unique default gen_random_uuid(),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);
create index minecraft_link_challenges_user_expiry_idx
  on public.minecraft_link_challenges (user_id, expires_at desc);

create table public.rank_metadata (
  rank_key text primary key check (rank_key ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  label_sk text not null check (length(label_sk) between 1 and 60),
  label_cs text not null check (length(label_cs) between 1 and 60),
  image_object_path text,
  display_order integer not null default 0,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.team_members (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  rank_key text references public.rank_metadata(rank_key) on delete set null,
  role_sk text not null check (length(role_sk) between 1 and 80),
  role_cs text not null check (length(role_cs) between 1 and 80),
  bio_sk text,
  bio_cs text,
  display_order integer not null default 0,
  is_listed boolean not null default true,
  created_at timestamptz not null default now(),
  check (bio_sk is null or length(bio_sk) <= 1000),
  check (bio_cs is null or length(bio_cs) <= 1000)
);

create table public.game_modes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  name text not null check (length(name) between 1 and 80),
  description_sk text,
  description_cs text,
  display_order integer not null default 0,
  is_listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  language text not null check (language in ('sk', 'cs')),
  title text not null check (length(title) between 1 and 160),
  body_markdown text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  publish_at timestamptz,
  seo_title text check (seo_title is null or length(seo_title) <= 160),
  seo_description text check (seo_description is null or length(seo_description) <= 320),
  canonical_url text,
  open_graph_object_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, language),
  check (status <> 'published' or publish_at is not null),
  check (canonical_url is null or canonical_url ~ '^https://')
);
create index site_pages_public_idx on public.site_pages (language, slug, publish_at desc)
  where status = 'published';

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  language text not null check (language in ('sk', 'cs')),
  title text not null check (length(title) between 1 and 180),
  excerpt text check (excerpt is null or length(excerpt) <= 500),
  body_markdown text not null default '',
  cover_object_path text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  publish_at timestamptz,
  seo_title text check (seo_title is null or length(seo_title) <= 160),
  seo_description text check (seo_description is null or length(seo_description) <= 320),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, language),
  check (status <> 'published' or publish_at is not null)
);
create index news_articles_public_idx on public.news_articles (publish_at desc, id)
  where status = 'published';

create table public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  name_sk text not null,
  name_cs text not null,
  description_sk text,
  description_cs text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(title) between 4 and 180),
  status text not null default 'open' check (status in ('open', 'locked', 'hidden', 'removed')),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index forum_topics_public_idx on public.forum_topics (category_id, is_pinned desc, updated_at desc)
  where status in ('open', 'locked');

create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  body_markdown text not null check (length(body_markdown) between 1 and 12000),
  visibility text not null default 'published' check (visibility in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index forum_posts_topic_idx on public.forum_posts (topic_id, created_at, id)
  where visibility = 'published';

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  target_type text not null check (target_type in ('forum_topic', 'forum_post', 'profile')),
  target_id uuid not null,
  reason text not null check (length(reason) between 3 and 1200),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index content_reports_queue_idx on public.content_reports (status, created_at);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  category text not null check (length(category) between 1 and 60),
  subject text not null check (length(subject) between 4 and 180),
  status text not null default 'open' check (status in ('open', 'waiting', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index tickets_owner_updated_idx on public.tickets (owner_user_id, updated_at desc);
create index tickets_staff_queue_idx on public.tickets (status, updated_at desc);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete restrict,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (length(body) between 1 and 12000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at, id);

create table public.recruitment_forms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  title_sk text not null,
  title_cs text not null,
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  is_open boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table public.recruitment_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.recruitment_forms(id) on delete restrict,
  applicant_email text not null check (length(applicant_email) between 3 and 254),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  status text not null default 'new' check (status in ('new', 'reviewing', 'interview', 'accepted', 'rejected')),
  internal_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (internal_notes is null or length(internal_notes) <= 12000)
);
create index recruitment_submissions_queue_idx on public.recruitment_submissions (status, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (length(kind) between 1 and 60),
  title text not null check (length(title) between 1 and 180),
  body text check (body is null or length(body) <= 2000),
  target_path text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  check (target_path is null or (left(target_path, 1) = '/' and left(target_path, 2) <> '//'))
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc)
  where is_read = false;

create table public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (length(kind) between 1 and 60),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

create table public.web_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(reason) between 1 and 2000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index web_bans_user_active_idx on public.web_bans (user_id, starts_at desc, ends_at);

create table public.site_settings (
  setting_key text primary key check (setting_key ~ '^[a-z0-9][a-z0-9_.-]{0,99}$'),
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.bridge_heartbeats (
  component text primary key check (component in ('velocity', 'paper', 'luckperms')),
  observed_at timestamptz not null,
  status text not null check (status in ('healthy', 'degraded', 'unavailable')),
  version text,
  request_id uuid not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  check (version is null or length(version) <= 80)
);

create table public.bridge_nonces (
  nonce text primary key check (nonce ~ '^[0-9a-f-]{36}$'),
  request_id uuid not null,
  direction text not null check (direction = 'response'),
  seen_at timestamptz not null default now()
);
create index bridge_nonces_seen_idx on public.bridge_nonces (seen_at);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 120),
  target_type text not null check (length(target_type) between 1 and 80),
  target_id text check (target_id is null or length(target_id) <= 160),
  result text not null check (result in ('success', 'denied', 'failed')),
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (not (metadata ?| array['password', 'token', 'secret', 'authorization', 'request_body', 'verification_code']))
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_actor_idx on public.admin_audit_logs (actor_user_id, created_at desc);

create view public.public_team_members with (security_barrier = true) as
select tm.user_id, p.display_name, p.minecraft_username, tm.role_sk, tm.role_cs,
  tm.bio_sk, tm.bio_cs, tm.display_order
from public.team_members tm
join public.profiles p on p.user_id = tm.user_id and p.is_public
where tm.is_listed;

create view public.public_forum_posts with (security_barrier = true) as
select fp.id, fp.topic_id,
  case when p.is_public then coalesce(p.display_name, p.minecraft_username) else null end as author_name,
  fp.body_markdown, fp.created_at
from public.forum_posts fp
join public.forum_topics t on t.id = fp.topic_id and t.status in ('open', 'locked')
join public.forum_categories c on c.id = t.category_id and c.is_visible
left join public.profiles p on p.user_id = fp.author_user_id and p.is_public
where fp.visibility = 'published';

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger game_modes_set_updated_at before update on public.game_modes
  for each row execute function public.set_updated_at();
create trigger site_pages_set_updated_at before update on public.site_pages
  for each row execute function public.set_updated_at();
create trigger news_articles_set_updated_at before update on public.news_articles
  for each row execute function public.set_updated_at();
create trigger forum_topics_set_updated_at before update on public.forum_topics
  for each row execute function public.set_updated_at();
create trigger forum_posts_set_updated_at before update on public.forum_posts
  for each row execute function public.set_updated_at();
create trigger tickets_set_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();
create trigger recruitment_forms_set_updated_at before update on public.recruitment_forms
  for each row execute function public.set_updated_at();
create trigger recruitment_submissions_set_updated_at before update on public.recruitment_submissions
  for each row execute function public.set_updated_at();
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.minecraft_link_challenges enable row level security;
alter table public.rank_metadata enable row level security;
alter table public.team_members enable row level security;
alter table public.game_modes enable row level security;
alter table public.site_pages enable row level security;
alter table public.news_articles enable row level security;
alter table public.forum_categories enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;
alter table public.content_reports enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.recruitment_forms enable row level security;
alter table public.recruitment_submissions enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.web_bans enable row level security;
alter table public.site_settings enable row level security;
alter table public.bridge_heartbeats enable row level security;
alter table public.bridge_nonces enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on public.profiles, public.minecraft_link_challenges, public.rank_metadata,
  public.team_members, public.game_modes, public.site_pages, public.news_articles,
  public.forum_categories, public.forum_topics, public.forum_posts, public.content_reports,
  public.tickets, public.ticket_messages, public.recruitment_forms,
  public.recruitment_submissions, public.notifications, public.notification_preferences,
  public.web_bans, public.site_settings, public.bridge_heartbeats, public.bridge_nonces,
  public.admin_audit_logs from anon, authenticated;

grant all on public.profiles, public.minecraft_link_challenges, public.rank_metadata,
  public.team_members, public.game_modes, public.site_pages, public.news_articles,
  public.forum_categories, public.forum_topics, public.forum_posts, public.content_reports,
  public.tickets, public.ticket_messages, public.recruitment_forms,
  public.recruitment_submissions, public.notifications, public.notification_preferences,
  public.web_bans, public.site_settings, public.bridge_heartbeats, public.bridge_nonces,
  public.admin_audit_logs to service_role;
grant usage, select on sequence public.admin_audit_logs_id_seq to service_role;

grant select (user_id, minecraft_username, display_name, bio, is_public, created_at)
  on public.profiles to anon, authenticated;
grant select on public.rank_metadata, public.game_modes, public.forum_categories
  to anon, authenticated;
grant select (id, category_id, title, status, is_pinned, created_at, updated_at)
  on public.forum_topics to anon, authenticated;
grant select (id, slug, language, title, excerpt, body_markdown, cover_object_path, status, publish_at, seo_title, seo_description)
  on public.news_articles to anon, authenticated;
grant select (id, slug, language, title, body_markdown, status, publish_at, seo_title, seo_description, canonical_url, open_graph_object_path)
  on public.site_pages to anon, authenticated;
grant select (id, slug, title_sk, title_cs, fields, is_open, opens_at, closes_at)
  on public.recruitment_forms to anon, authenticated;
grant select on public.public_team_members, public.public_forum_posts to anon, authenticated;
grant update (display_name, bio, is_public) on public.profiles to authenticated;
grant select (id, category, subject, status, created_at, updated_at, closed_at)
  on public.tickets to authenticated;
grant select (id, ticket_id, body, created_at)
  on public.ticket_messages to authenticated;
grant select (id, user_id, kind, title, body, target_path, is_read, created_at)
  on public.notifications to authenticated;
grant select (user_id, kind, enabled, updated_at)
  on public.notification_preferences to authenticated;
grant select (id, reason, starts_at, ends_at, created_at)
  on public.web_bans to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant update (enabled) on public.notification_preferences to authenticated;

create policy profiles_public_or_self_read on public.profiles
  for select to anon, authenticated
  using (is_public or user_id = (select auth.uid()));
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy rank_metadata_public_read on public.rank_metadata
  for select to anon, authenticated using (is_public);
create policy team_members_public_read on public.team_members
  for select to anon, authenticated
  using (is_listed and exists (
    select 1 from public.profiles p
    where p.user_id = team_members.user_id and p.is_public
  ));
create policy game_modes_public_read on public.game_modes
  for select to anon, authenticated using (is_listed);
create policy site_pages_published_read on public.site_pages
  for select to anon, authenticated
  using (status = 'published' and publish_at <= now());
create policy news_articles_published_read on public.news_articles
  for select to anon, authenticated
  using (status = 'published' and publish_at <= now());
create policy recruitment_forms_open_read on public.recruitment_forms
  for select to anon, authenticated
  using (
    is_open
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at > now())
  );

create policy forum_categories_public_read on public.forum_categories
  for select to anon, authenticated using (is_visible);
create policy forum_topics_public_read on public.forum_topics
  for select to anon, authenticated
  using (
    status in ('open', 'locked')
    and exists (
      select 1 from public.forum_categories c
      where c.id = forum_topics.category_id and c.is_visible
    )
  );
create policy forum_posts_read_visible_or_own on public.forum_posts
  for select to anon, authenticated
  using (
    author_user_id = (select auth.uid())
    or (
      visibility = 'published'
      and exists (
        select 1 from public.forum_topics t
        join public.forum_categories c on c.id = t.category_id
        where t.id = forum_posts.topic_id
          and t.status in ('open', 'locked')
          and c.is_visible
      )
    )
  );
create policy forum_posts_create_as_self on public.forum_posts
  for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and visibility = 'published'
    and exists (
      select 1 from public.forum_topics t
      join public.forum_categories c on c.id = t.category_id
      where t.id = forum_posts.topic_id
        and t.status = 'open'
        and c.is_visible
    )
  );
create policy forum_posts_edit_own_recent on public.forum_posts
  for update to authenticated
  using (
    author_user_id = (select auth.uid())
    and created_at > now() - interval '15 minutes'
    and visibility = 'published'
  )
  with check (author_user_id = (select auth.uid()) and visibility = 'published');
create policy content_reports_create_as_self on public.content_reports
  for insert to authenticated
  with check (reporter_user_id = (select auth.uid()));

create policy tickets_owner_read on public.tickets
  for select to authenticated
  using (owner_user_id = (select auth.uid()));
create policy ticket_messages_owner_read_public on public.ticket_messages
  for select to authenticated
  using (
    not is_internal
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_messages.ticket_id and t.owner_user_id = (select auth.uid())
    )
  );
create policy ticket_messages_owner_reply on public.ticket_messages
  for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and not is_internal
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_messages.ticket_id
        and t.owner_user_id = (select auth.uid())
        and t.status not in ('resolved', 'closed')
    )
  );

create policy notifications_owner_read on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_owner_mark_read on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy notification_preferences_owner_read on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_owner_update on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy web_bans_self_read on public.web_bans
  for select to authenticated using (user_id = (select auth.uid()));

commit;

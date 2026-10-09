begin;

create or replace function public.save_team_member(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_role_sk text,
  p_role_cs text,
  p_bio_sk text,
  p_bio_cs text,
  p_display_order integer,
  p_is_listed boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  is_public_profile boolean;
begin
  if p_actor_user_id is null
     or p_user_id is null
     or p_role_sk is null or length(trim(p_role_sk)) not between 1 and 80
     or p_role_cs is null or length(trim(p_role_cs)) not between 1 and 80
     or p_bio_sk is not null and length(p_bio_sk) > 1000
     or p_bio_cs is not null and length(p_bio_cs) > 1000
     or p_display_order not between -10000 and 10000
     or p_is_listed is null then
    raise exception using errcode = '22023', message = 'Invalid team member fields';
  end if;

  select is_public into is_public_profile
  from public.profiles
  where user_id = p_user_id and minecraft_uuid is not null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Linked Minecraft profile not found';
  end if;
  if p_is_listed and not is_public_profile then
    raise exception using errcode = 'P0001', message = 'Player profile is not public';
  end if;

  insert into public.team_members
    (user_id, role_sk, role_cs, bio_sk, bio_cs, display_order, is_listed)
  values
    (p_user_id, trim(p_role_sk), trim(p_role_cs), p_bio_sk, p_bio_cs,
     p_display_order, p_is_listed)
  on conflict (user_id) do update
    set role_sk = excluded.role_sk,
        role_cs = excluded.role_cs,
        bio_sk = excluded.bio_sk,
        bio_cs = excluded.bio_cs,
        display_order = excluded.display_order,
        is_listed = excluded.is_listed;

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_actor_user_id, 'team.member.save', 'team_member', p_user_id::text,
     'success', jsonb_build_object('is_listed', p_is_listed,
                                   'display_order', p_display_order));
  return p_user_id;
end;
$$;

revoke all on function public.save_team_member(uuid, uuid, text, text, text, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.save_team_member(uuid, uuid, text, text, text, text, integer, boolean)
  to service_role;

commit;
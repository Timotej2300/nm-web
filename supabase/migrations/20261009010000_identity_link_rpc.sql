begin;

create or replace function public.link_minecraft_identity(
  p_user_id uuid,
  p_uuid uuid,
  p_username text,
  p_code_hash text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_username !~ '^[A-Za-z0-9_]{3,16}$'
     or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid identity link';
  end if;

  insert into public.minecraft_link_challenges
    (user_id, code_hash, created_at, expires_at, consumed_at)
  values
    (p_user_id, p_code_hash, now(), now() + interval '2 minutes', now());

  insert into public.profiles (user_id, minecraft_uuid, minecraft_username)
  values (p_user_id, p_uuid, p_username)
  on conflict (user_id) do update
    set minecraft_uuid = excluded.minecraft_uuid,
        minecraft_username = excluded.minecraft_username
    where public.profiles.minecraft_uuid is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'Identity already linked';
  end if;

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_user_id, 'identity.link', 'minecraft_identity', p_uuid::text, 'success',
     jsonb_build_object('username', p_username));
end;
$$;

revoke all on function public.link_minecraft_identity(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.link_minecraft_identity(uuid, uuid, text, text)
  to service_role;

commit;
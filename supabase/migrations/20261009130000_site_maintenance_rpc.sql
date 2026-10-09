begin;

create or replace function public.set_site_maintenance(
  p_actor_user_id uuid,
  p_enabled boolean,
  p_message_sk text,
  p_message_cs text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_actor_user_id is null
     or p_enabled is null
     or p_message_sk is not null and length(p_message_sk) > 500
     or p_message_cs is not null and length(p_message_cs) > 500 then
    raise exception using errcode = '22023', message = 'Invalid maintenance settings';
  end if;

  insert into public.site_settings (setting_key, value, updated_by, updated_at)
  values (
    'maintenance',
    jsonb_build_object(
      'enabled', p_enabled,
      'message_sk', nullif(trim(p_message_sk), ''),
      'message_cs', nullif(trim(p_message_cs), '')
    ),
    p_actor_user_id,
    now()
  )
  on conflict (setting_key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now();

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_actor_user_id, 'site.maintenance.update', 'site_setting', 'maintenance',
     'success', jsonb_build_object('enabled', p_enabled));

  return jsonb_build_object('enabled', p_enabled);
end;
$$;

revoke all on function public.set_site_maintenance(uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.set_site_maintenance(uuid, boolean, text, text)
  to service_role;

commit;
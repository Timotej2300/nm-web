begin;

create or replace function public.review_recruitment_submission(
  p_actor_user_id uuid,
  p_submission_id uuid,
  p_status text,
  p_internal_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_submission public.recruitment_submissions%rowtype;
begin
  if p_actor_user_id is null
     or p_status is null
     or p_status not in ('new', 'reviewing', 'interview', 'accepted', 'rejected')
     or p_internal_notes is not null and length(p_internal_notes) > 12000 then
    raise exception using errcode = '22023', message = 'Invalid recruitment review';
  end if;

  select * into current_submission
  from public.recruitment_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Application not found';
  end if;

  update public.recruitment_submissions
  set status = p_status,
      internal_notes = p_internal_notes,
      reviewed_by = case when p_status = 'new' then null else p_actor_user_id end,
      updated_at = now()
  where id = p_submission_id;

  insert into public.admin_audit_logs
    (actor_user_id, action, target_type, target_id, result, metadata)
  values
    (p_actor_user_id, 'recruitment.review', 'recruitment_submission',
     p_submission_id::text, 'success',
     jsonb_build_object('status_before', current_submission.status,
                        'status_after', p_status));

  return jsonb_build_object('id', p_submission_id, 'status', p_status);
end;
$$;

revoke all on function public.review_recruitment_submission(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_recruitment_submission(uuid, uuid, text, text)
  to service_role;

commit;
begin;

create or replace function public.submit_recruitment_application(
  p_form_id uuid,
  p_applicant_email text,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  submission_id uuid;
begin
  if length(trim(p_applicant_email)) not between 3 and 254
     or position('@' in p_applicant_email) < 2
     or jsonb_typeof(p_answers) <> 'object'
     or octet_length(p_answers::text) > 16384 then
    raise exception using errcode = '22023', message = 'Invalid application';
  end if;

  if not exists (
    select 1 from public.recruitment_forms
    where id = p_form_id
      and is_open
      and (opens_at is null or opens_at <= now())
      and (closes_at is null or closes_at > now())
  ) then
    raise exception using errcode = 'P0001', message = 'Recruitment form unavailable';
  end if;

  insert into public.recruitment_submissions (form_id, applicant_email, answers)
  values (p_form_id, lower(trim(p_applicant_email)), p_answers)
  returning id into submission_id;
  return submission_id;
end;
$$;

revoke all on function public.submit_recruitment_application(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_recruitment_application(uuid, text, jsonb)
  to service_role;

commit;
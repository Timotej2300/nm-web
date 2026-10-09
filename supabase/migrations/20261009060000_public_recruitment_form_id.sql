begin;

grant select (id, slug, title_sk, title_cs, fields, is_open, opens_at, closes_at)
  on public.recruitment_forms to anon, authenticated;

commit;
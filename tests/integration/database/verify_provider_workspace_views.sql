\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'owner-recents@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'editor-recents@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'viewer-recents@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.profiles set role = 'owner' where id = '10000000-0000-4000-8000-000000000004';
update public.profiles set role = 'editor' where id = '10000000-0000-4000-8000-000000000005';
update public.profiles set role = 'viewer' where id = '10000000-0000-4000-8000-000000000006';

do $$
begin
  if has_table_privilege('anon', 'public.provider_workspace_views', 'SELECT')
    or has_table_privilege('authenticated', 'public.provider_workspace_views', 'INSERT')
    or has_table_privilege('authenticated', 'public.provider_workspace_views', 'UPDATE')
    or has_table_privilege('authenticated', 'public.provider_workspace_views', 'DELETE')
    or has_function_privilege('anon', 'public.record_provider_workspace_view(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.record_provider_workspace_view(uuid)', 'EXECUTE') then
    raise exception 'Unsafe provider workspace view ACL';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', true);

do $$
declare
  provider_ids uuid[];
  target_provider uuid;
  first_count bigint;
  second_count bigint;
  i integer;
begin
  select array_agg(id order by business_name, id)
  into provider_ids
  from (
    select id, business_name
    from public.providers
    where archived_at is null
    order by business_name, id
    limit 12
  ) providers;

  if coalesce(array_length(provider_ids, 1), 0) < 12 then
    raise exception 'Provider recency verification requires at least 12 providers';
  end if;

  target_provider := provider_ids[1];
  perform public.record_provider_workspace_view(target_provider);
  select open_count into first_count
  from public.provider_workspace_views
  where provider_id = target_provider;

  perform public.record_provider_workspace_view(target_provider);
  select open_count into second_count
  from public.provider_workspace_views
  where provider_id = target_provider;

  if first_count <> 1 or second_count <> 2 then
    raise exception 'Reopening did not upsert and deduplicate the provider view';
  end if;

  for i in 2..12 loop
    perform public.record_provider_workspace_view(provider_ids[i]);
  end loop;

  perform pg_sleep(0.001);
  perform public.record_provider_workspace_view(provider_ids[12]);

  if (select count(*) from public.provider_workspace_views) <> 12 then
    raise exception 'Provider workspace views were not retained as one row per provider';
  end if;

  if (select count(*) from (
    select provider_id
    from public.provider_workspace_views
    order by last_opened_at desc, provider_id
    limit 10
  ) recent) <> 10 then
    raise exception 'Recent provider query did not cap at ten';
  end if;

  if (select provider_id from public.provider_workspace_views order by last_opened_at desc, provider_id limit 1)
    <> provider_ids[12] then
    raise exception 'Recent provider ordering is not newest first';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);

do $$
declare
  provider_id uuid;
begin
  if exists (select 1 from public.provider_workspace_views) then
    raise exception 'Editor can read another user''s recent providers';
  end if;

  select id into provider_id from public.providers where archived_at is null order by id limit 1;
  perform public.record_provider_workspace_view(provider_id);

  if (select count(*) from public.provider_workspace_views) <> 1 then
    raise exception 'Editor could not record personal provider recency';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);

do $$
declare
  provider_id uuid;
begin
  if exists (select 1 from public.provider_workspace_views) then
    raise exception 'Owner can read another user''s recent providers';
  end if;

  select id into provider_id from public.providers where archived_at is null order by id desc limit 1;
  perform public.record_provider_workspace_view(provider_id);

  if (select count(*) from public.provider_workspace_views) <> 1 then
    raise exception 'Owner could not record personal provider recency';
  end if;
end;
$$;

rollback;

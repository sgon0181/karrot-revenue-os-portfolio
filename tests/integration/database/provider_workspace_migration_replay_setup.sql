\set ON_ERROR_STOP on

drop schema if exists migration_replay_test cascade;
create schema migration_replay_test;

create table migration_replay_test.snapshots (
  name text primary key,
  value jsonb not null
);

create function migration_replay_test.provider_workspace_contract()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'table', (
      select jsonb_build_object(
        'owner', pg_catalog.pg_get_userbyid(c.relowner),
        'rls_enabled', c.relrowsecurity,
        'rls_forced', c.relforcerowsecurity,
        'acl', coalesce(c.relacl::text, '<default>')
      )
      from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.provider_workspace_views')
    ),
    'columns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', a.attname,
        'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull,
        'identity', a.attidentity,
        'generated', a.attgenerated,
        'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid)
      ) order by a.attnum), '[]'::jsonb)
      from pg_catalog.pg_attribute a
      left join pg_catalog.pg_attrdef d
        on d.adrelid = a.attrelid
       and d.adnum = a.attnum
      where a.attrelid = pg_catalog.to_regclass('public.provider_workspace_views')
        and a.attnum > 0
        and not a.attisdropped
    ),
    'constraints', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', con.conname,
        'type', con.contype,
        'definition', pg_catalog.pg_get_constraintdef(con.oid, true)
      ) order by con.conname), '[]'::jsonb)
      from pg_catalog.pg_constraint con
      where con.conrelid = pg_catalog.to_regclass('public.provider_workspace_views')
    ),
    'indexes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', indexname,
        'definition', indexdef
      ) order by indexname), '[]'::jsonb)
      from pg_catalog.pg_indexes
      where schemaname = 'public'
        and tablename = 'provider_workspace_views'
    ),
    'policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', policyname,
        'permissive', permissive,
        'roles', to_jsonb(roles),
        'command', cmd,
        'using', qual,
        'check', with_check
      ) order by policyname), '[]'::jsonb)
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'provider_workspace_views'
    ),
    'table_privileges', jsonb_build_object(
      'anon_select', pg_catalog.has_table_privilege('anon', 'public.provider_workspace_views', 'SELECT'),
      'authenticated_select', pg_catalog.has_table_privilege('authenticated', 'public.provider_workspace_views', 'SELECT'),
      'authenticated_insert', pg_catalog.has_table_privilege('authenticated', 'public.provider_workspace_views', 'INSERT'),
      'authenticated_update', pg_catalog.has_table_privilege('authenticated', 'public.provider_workspace_views', 'UPDATE'),
      'authenticated_delete', pg_catalog.has_table_privilege('authenticated', 'public.provider_workspace_views', 'DELETE'),
      'service_role_select', pg_catalog.has_table_privilege('service_role', 'public.provider_workspace_views', 'SELECT'),
      'service_role_insert', pg_catalog.has_table_privilege('service_role', 'public.provider_workspace_views', 'INSERT'),
      'service_role_update', pg_catalog.has_table_privilege('service_role', 'public.provider_workspace_views', 'UPDATE'),
      'service_role_delete', pg_catalog.has_table_privilege('service_role', 'public.provider_workspace_views', 'DELETE')
    ),
    'function', (
      select jsonb_build_object(
        'owner', pg_catalog.pg_get_userbyid(p.proowner),
        'security_definer', p.prosecdef,
        'configuration', to_jsonb(p.proconfig),
        'acl', coalesce(p.proacl::text, '<default>'),
        'definition', pg_catalog.pg_get_functiondef(p.oid),
        'anon_execute', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
        'authenticated_execute', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        'service_role_execute', pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
      from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.record_provider_workspace_view(uuid)')
    )
  );
$$;

create function migration_replay_test.canonical_counts()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'source_files', (select count(*) from public.source_files),
    'import_runs', (select count(*) from public.import_runs),
    'source_records', (select count(*) from public.source_records),
    'providers', (select count(*) from public.providers where not is_sample),
    'provider_snapshots', (select count(*) from public.provider_snapshots),
    'facilities', (select count(*) from public.facilities where not is_sample),
    'facility_snapshots', (select count(*) from public.facility_snapshots)
  );
$$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '10000000-0000-4000-8000-000000000007',
  'authenticated',
  'authenticated',
  'migration-replay-recents@karrot.invalid',
  '{}'::jsonb,
  '{}'::jsonb,
  '2026-08-26 00:00:00+00',
  '2026-08-26 00:00:00+00'
)
on conflict (id) do nothing;

update public.profiles
set role = 'viewer'
where id = '10000000-0000-4000-8000-000000000007';

delete from public.provider_workspace_views
where user_id = '10000000-0000-4000-8000-000000000007';

insert into public.provider_workspace_views (
  user_id,
  provider_id,
  first_opened_at,
  last_opened_at,
  open_count
)
select
  '10000000-0000-4000-8000-000000000007',
  id,
  '2026-08-20 01:00:00+00',
  '2026-08-26 01:00:00+00',
  7
from public.providers
where archived_at is null and not is_sample
order by id
limit 1;

do $$
begin
  if (select count(*) from public.providers where not is_sample) <> 237
    or (select count(*) from public.facilities where not is_sample) <> 926 then
    raise exception 'Audited canonical provider/facility counts are not loaded before replay verification';
  end if;

  if (
    select count(*)
    from public.provider_workspace_views
    where user_id = '10000000-0000-4000-8000-000000000007'
  ) <> 1 then
    raise exception 'Representative personal provider history fixture was not created';
  end if;
end;
$$;

insert into migration_replay_test.snapshots (name, value) values
  ('provider_workspace_contract', migration_replay_test.provider_workspace_contract()),
  ('canonical_counts', migration_replay_test.canonical_counts()),
  ('personal_history', (
    select jsonb_build_object(
      'total_count', (select count(*) from public.provider_workspace_views),
      'representative_rows', coalesce(jsonb_agg(to_jsonb(v) order by v.provider_id), '[]'::jsonb)
    )
    from public.provider_workspace_views v
    where v.user_id = '10000000-0000-4000-8000-000000000007'
  ));

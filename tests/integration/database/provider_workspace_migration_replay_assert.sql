\set ON_ERROR_STOP on

do $$
declare
  before_value jsonb;
  after_value jsonb;
begin
  select value into before_value
  from migration_replay_test.snapshots
  where name = 'provider_workspace_contract';

  after_value := migration_replay_test.provider_workspace_contract();
  if before_value is distinct from after_value then
    raise exception 'Tracked migration replay changed provider_workspace_views schema, RLS, policies, or grants';
  end if;

  select value into before_value
  from migration_replay_test.snapshots
  where name = 'canonical_counts';

  after_value := migration_replay_test.canonical_counts();
  if before_value is distinct from after_value then
    raise exception 'Tracked migration replay changed canonical or import counts: before %, after %', before_value, after_value;
  end if;

  select value into before_value
  from migration_replay_test.snapshots
  where name = 'personal_history';

  select jsonb_build_object(
    'total_count', (select count(*) from public.provider_workspace_views),
    'representative_rows', coalesce(jsonb_agg(to_jsonb(v) order by v.provider_id), '[]'::jsonb)
  )
  into after_value
  from public.provider_workspace_views v
  where v.user_id = '10000000-0000-4000-8000-000000000007';

  if before_value is distinct from after_value then
    raise exception 'Tracked migration replay changed personal provider history: before %, after %', before_value, after_value;
  end if;
end;
$$;

delete from auth.users
where id = '10000000-0000-4000-8000-000000000007';

drop schema migration_replay_test cascade;

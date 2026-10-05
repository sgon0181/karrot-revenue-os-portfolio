\set ON_ERROR_STOP on

do $$
declare
  st_basils_provider uuid;
  st_basils_randwick uuid;
  other_provider uuid;
begin
  select id into st_basils_provider
  from public.providers
  where abn = '47082585988';

  select id into st_basils_randwick
  from public.facilities
  where provider_id = st_basils_provider
    and name = 'St Basil''s Randwick';

  if st_basils_provider is null or st_basils_randwick is null then
    raise exception 'Canonical St Basil''s fixture is unavailable for replay verification';
  end if;

  select id into other_provider
  from public.providers
  where abn <> '47082585988'
    and not is_sample
    and archived_at is null
  order by abn
  limit 1;

  if other_provider is null then
    raise exception 'A second canonical provider is unavailable for replay verification';
  end if;

  insert into public.contacts (
    id, provider_id, facility_id, full_name, record_mode
  ) values (
    '5a777777-0000-4000-8000-000000000001',
    st_basils_provider,
    st_basils_randwick,
    'Unrelated sandbox sentinel',
    'sandbox'
  );

  insert into public.opportunities (
    id, provider_id, name, stage_id, record_mode
  ) values
    (
      '5a777777-0000-4000-8000-000000000002',
      st_basils_provider,
      'James demo — St Basil’s Randwick discovery',
      '00000000-0000-4000-8000-000000000006',
      'sandbox'
    ),
    (
      '5a777777-0000-4000-8000-000000000003',
      st_basils_provider,
      'Unrelated St Basil''s sandbox opportunity',
      '00000000-0000-4000-8000-000000000001',
      'sandbox'
    ),
    (
      '5a777777-0000-4000-8000-000000000008',
      other_provider,
      'James demo — St Basil’s Randwick discovery',
      '00000000-0000-4000-8000-000000000001',
      'sandbox'
    );

  insert into public.activities (
    id, provider_id, facility_id, opportunity_id,
    activity_type, subject, record_mode
  ) values (
    '5a777777-0000-4000-8000-000000000004',
    st_basils_provider,
    st_basils_randwick,
    '5a777777-0000-4000-8000-000000000002',
    'call',
    'Exact W1 dependent activity sentinel',
    'sandbox'
  );

  insert into public.next_actions (
    id, provider_id, opportunity_id, title, record_mode
  ) values (
    '5a777777-0000-4000-8000-000000000005',
    st_basils_provider,
    '5a777777-0000-4000-8000-000000000002',
    'Exact W1 dependent action sentinel',
    'sandbox'
  );

  insert into public.customer_relationships (
    id, provider_id, originating_opportunity_id, status, record_mode
  ) values (
    '5a777777-0000-4000-8000-000000000006',
    st_basils_provider,
    '5a777777-0000-4000-8000-000000000002',
    'active',
    'sandbox'
  );

  insert into public.customer_facilities (
    id, customer_relationship_id, facility_id, status
  ) values (
    '5a777777-0000-4000-8000-000000000007',
    '5a777777-0000-4000-8000-000000000006',
    st_basils_randwick,
    'contracted'
  );
end;
$$;

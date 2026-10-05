\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '10000000-0000-4000-8000-000000000020',
    'authenticated', 'authenticated', 'sample-editor@karrot.invalid',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000021',
    'authenticated', 'authenticated', 'sample-owner@karrot.invalid',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

update public.profiles
set role = 'editor'
where id = '10000000-0000-4000-8000-000000000020';

update public.profiles
set role = 'owner'
where id = '10000000-0000-4000-8000-000000000021';

do $$
declare
  metrics public.v_dashboard_metrics%rowtype;
begin
  if not exists (
    select 1
    from public.providers
    where id = '5a000000-0000-4000-8000-000000000001'
      and business_name = 'Sample Oscorp Retirement Home'
      and entity_name = 'Sample Oscorp Retirement Home'
      and abn = '00000000000'
      and is_sample
      and current_authoritative_source_record_id is null
      and archived_at is null
  ) then
    raise exception 'Sample provider fixture is missing or crossed the authoritative boundary';
  end if;

  if not exists (
    select 1
    from public.v_facility_latest
    where id = '5a000000-0000-4000-8000-000000000002'
      and provider_id = '5a000000-0000-4000-8000-000000000001'
      and name = 'Sample Queens Uncle Ben House'
      and full_address = 'Bennelong Point, Sydney NSW 2000'
      and location_label = 'Sydney Opera House Attic'
      and latitude = -33.8566674153
      and longitude = 151.2152213360
      and is_sample
  ) then
    raise exception 'Sample facility fixture or Sydney Opera House map location is incorrect';
  end if;

  if not exists (
    select 1
    from public.v_provider_overview
    where id = '5a000000-0000-4000-8000-000000000001'
      and is_sample
      and facility_count = 1
      and contact_count = 2
      and open_opportunity_count = 1
      and current_commercial_activity = 'Discovery'
      and current_record_mode = 'sandbox'
      and next_action = 'Confirm discovery meeting with Peter Parker'
  ) then
    raise exception 'Sample provider directory summary does not expose its CRM journey';
  end if;

  if exists (
    select 1
    from public.v_provider_overview
    where id = '5a000000-0000-4000-8000-000000000001'
      and (
        search_text ilike '%00000000000%'
        or search_text ilike '%sample-oscorp-001%'
      )
  ) or not exists (
    select 1
    from public.v_provider_overview
    where id = '5a000000-0000-4000-8000-000000000001'
      and search_text ilike '%oscorp%'
      and search_text ilike '%queens%'
  ) then
    raise exception 'Provider directory search exposed synthetic sample identifiers or hid visible names';
  end if;

  if (
    select count(*)
    from public.contacts
    where provider_id = '5a000000-0000-4000-8000-000000000001'
      and record_mode = 'sandbox'
      and (
        (full_name = 'Norman Osborn' and title = 'Executive Director')
        or (
          full_name = 'Peter Parker'
          and title = 'Head of Friendly Neighborhood'
        )
      )
  ) <> 2 then
    raise exception 'Sample contacts are incomplete or not isolated as sandbox data';
  end if;

  if not exists (
    select 1
    from public.opportunities opportunity
    join public.pipeline_stages stage on stage.id = opportunity.stage_id
    where opportunity.id = '5a000000-0000-4000-8000-000000000005'
      and opportunity.name = 'Spidey Opera Care — precision-care pilot'
      and opportunity.record_mode = 'sandbox'
      and stage.code = 'DISCOVERY'
  ) then
    raise exception 'Sample Discovery opportunity is missing';
  end if;

  if not exists (
    select 1
    from public.activities
    where id = '5a000000-0000-4000-8000-000000000006'
      and subject = 'Introductory call — precision-care requirements'
      and occurred_at = '2026-08-25 10:00:00+10'::timestamptz
      and record_mode = 'sandbox'
  ) then
    raise exception 'Completed sample activity is missing';
  end if;

  if not exists (
    select 1
    from public.next_actions
    where id = '5a000000-0000-4000-8000-000000000007'
      and title = 'Confirm discovery meeting with Peter Parker'
      and status = 'open'
      and (due_at at time zone 'Australia/Sydney')::date = '2026-08-27'
      and record_mode = 'sandbox'
  ) then
    raise exception 'Open sample task or its next-business-day due date is incorrect';
  end if;

  if not exists (
    select 1
    from public.field_visits
    where id = '5a000000-0000-4000-8000-000000000008'
      and title = 'Spidey Opera Care Sales Meeting'
      and starts_at = '2026-09-01 10:00:00+10'::timestamptz
      and ends_at = '2026-09-01 10:30:00+10'::timestamptz
      and status = 'confirmed'
      and record_mode = 'sandbox'
  ) then
    raise exception 'Sample Planner meeting is missing or incorrectly scheduled';
  end if;

  if (
    select count(*)
    from public.v_global_search
    where provider_id = '5a000000-0000-4000-8000-000000000001'
      and object_type in ('provider', 'facility', 'contact', 'opportunity')
  ) <> 5 then
    raise exception 'Ordinary global search does not include the complete sample account';
  end if;

  if exists (
    select 1
    from public.v_global_search
    where provider_id = '5a000000-0000-4000-8000-000000000001'
      and (
        search_text ilike '%00000000000%'
        or search_text ilike '%sample-oscorp-001%'
      )
  ) or not exists (
    select 1
    from public.v_global_search
    where object_id = '5a000000-0000-4000-8000-000000000001'
      and search_text ilike '%oscorp%'
  ) or not exists (
    select 1
    from public.v_global_search
    where object_id = '5a000000-0000-4000-8000-000000000002'
      and search_text ilike '%queens%'
  ) then
    raise exception 'Global search exposed synthetic sample identifiers or hid visible names';
  end if;

  select * into metrics from public.v_dashboard_metrics;
  if metrics.nsw_providers <> (
    select count(*) from public.providers
    where archived_at is null and not is_sample
  ) or metrics.nsw_facilities <> (
    select count(*) from public.facilities
    where archived_at is null and state = 'NSW' and not is_sample
  ) then
    raise exception 'Official dashboard market totals include sample records';
  end if;

  if metrics.nsw_providers <> 237 or metrics.nsw_facilities <> 926 then
    raise exception 'Canonical NSW market totals changed after adding the sample account';
  end if;

  if (select count(*) from public.providers where archived_at is null) <> 238
    or (select count(*) from public.facilities where archived_at is null and state = 'NSW') <> 927 then
    raise exception 'Expected exactly one provider and facility outside official totals';
  end if;

  if not exists (
    select 1 from public.providers
    where abn = '47082585988' and business_name = 'ST BASILS HOMES' and not is_sample
  ) or not exists (
    select 1 from public.facilities
    where name = 'St Basil''s Randwick' and not is_sample
  ) then
    raise exception 'Canonical St Basil''s records were changed or removed';
  end if;

  if exists (
    select 1
    from public.opportunities opportunity
    join public.providers provider on provider.id = opportunity.provider_id
    where opportunity.name = 'James demo — St Basil’s Randwick discovery'
      and opportunity.record_mode = 'sandbox'
      and provider.abn = '47082585988'
  ) then
    raise exception 'Exact W1 practice opportunity remains';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger trigger_record
    where not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
      and trigger_record.tgname in (
        'facility_snapshots_reject_sample_source',
        'facility_snapshots_reject_sample_source_provider',
        'facility_aliases_reject_sample_source',
        'facility_match_decisions_reject_sample_source',
        'facility_match_candidates_reject_sample_source',
        'facility_match_review_events_reject_sample_source',
        'star_rating_snapshots_reject_sample_source',
        'care_minutes_snapshots_reject_sample_source'
      )
  ) <> 8 then
    raise exception 'Sample facility authoritative-source guards are incomplete';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger trigger_record
    where not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
      and trigger_record.tgname in (
        'provider_snapshots_reject_sample_source',
        'provider_aliases_reject_sample_source',
        'provider_service_types_reject_sample_source',
        'provider_lgas_reject_sample_source',
        'provider_regulatory_notices_reject_sample_source'
      )
  ) <> 5 then
    raise exception 'Sample provider authoritative-source guards are incomplete';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger trigger_record
    where not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
      and trigger_record.tgname in (
        'account_research_jobs_reject_sample',
        'intelligence_sources_reject_sample',
        'intelligence_claims_reject_sample',
        'commercial_account_facts_reject_sample',
        'intelligence_review_events_reject_sample'
      )
  ) <> 5 then
    raise exception 'Sample research-memory guards are incomplete';
  end if;
end;
$$;

-- Deliberately submit real mode for every sample commercial object. Database
-- triggers must coerce each insert to sandbox without changing normal accounts.
do $$
declare
  sample_provider constant uuid := '5a000000-0000-4000-8000-000000000001';
  sample_facility constant uuid := '5a000000-0000-4000-8000-000000000002';
  normal_provider uuid;
  inserted_mode text;
  default_visit_title text;
begin
  insert into public.contacts (
    id, provider_id, facility_id, full_name, title, record_mode
  ) values (
    '5a999999-0000-4000-8000-000000000001',
    sample_provider,
    sample_facility,
    'Sample boundary contact',
    'Mode guard',
    'real'
  ) returning record_mode into inserted_mode;
  if inserted_mode <> 'sandbox' then
    raise exception 'Sample contact was not coerced to sandbox';
  end if;

  insert into public.opportunities (
    id, provider_id, name, stage_id, primary_contact_id, record_mode
  ) values (
    '5a999999-0000-4000-8000-000000000002',
    sample_provider,
    'Sample boundary opportunity',
    '00000000-0000-4000-8000-000000000006',
    '5a999999-0000-4000-8000-000000000001',
    'real'
  ) returning record_mode into inserted_mode;
  if inserted_mode <> 'sandbox' then
    raise exception 'Sample opportunity was not coerced to sandbox';
  end if;

  insert into public.activities (
    id, provider_id, facility_id, opportunity_id, contact_id,
    activity_type, subject, record_mode
  ) values (
    '5a999999-0000-4000-8000-000000000003',
    sample_provider,
    sample_facility,
    '5a999999-0000-4000-8000-000000000002',
    '5a999999-0000-4000-8000-000000000001',
    'call',
    'Sample boundary activity',
    'real'
  ) returning record_mode into inserted_mode;
  if inserted_mode <> 'sandbox' then
    raise exception 'Sample activity was not coerced to sandbox';
  end if;

  insert into public.next_actions (
    id, provider_id, opportunity_id, contact_id, title, record_mode
  ) values (
    '5a999999-0000-4000-8000-000000000004',
    sample_provider,
    '5a999999-0000-4000-8000-000000000002',
    '5a999999-0000-4000-8000-000000000001',
    'Sample boundary action',
    'real'
  ) returning record_mode into inserted_mode;
  if inserted_mode <> 'sandbox' then
    raise exception 'Sample next action was not coerced to sandbox';
  end if;

  insert into public.customer_relationships (
    id, provider_id, originating_opportunity_id, status, record_mode
  ) values (
    '5a999999-0000-4000-8000-000000000005',
    sample_provider,
    '5a999999-0000-4000-8000-000000000002',
    'active',
    'real'
  ) returning record_mode into inserted_mode;
  if inserted_mode <> 'sandbox' then
    raise exception 'Sample customer was not coerced to sandbox';
  end if;

  insert into public.field_visits (
    id, facility_id, contact_id, starts_at, ends_at, status, record_mode
  ) values (
    '5a999999-0000-4000-8000-000000000006',
    sample_facility,
    '5a999999-0000-4000-8000-000000000001',
    '2026-09-02 10:00:00+10',
    '2026-09-02 10:30:00+10',
    'tentative',
    'real'
  ) returning record_mode, title into inserted_mode, default_visit_title;
  if inserted_mode <> 'sandbox'
    or default_visit_title <> 'Sample Queens Uncle Ben House visit' then
    raise exception 'Sample visit mode or default title boundary failed';
  end if;

  select id into normal_provider
  from public.providers
  where archived_at is null and not is_sample
  order by abn
  limit 1;

  insert into public.contacts (
    id, provider_id, full_name, record_mode
  ) values (
    '5a999999-0000-4000-8000-000000000007',
    normal_provider,
    'Normal real-mode sentinel',
    'real'
  ) returning record_mode into inserted_mode;
  if inserted_mode <> 'real' then
    raise exception 'Normal provider commercial mode was changed';
  end if;

  insert into public.contacts (
    id, provider_id, full_name, record_mode
  ) values (
    '5a999999-0000-4000-8000-000000000008',
    normal_provider,
    'Normal sandbox reset sentinel',
    'sandbox'
  );

  begin
    update public.providers set is_sample = false where id = sample_provider;
    raise exception 'Sample provider scope was mutable';
  exception
    when raise_exception then
      if sqlerrm not like 'Sample scope cannot change%' then
        raise;
      end if;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000021', true);

do $$
begin
  perform public.reset_sandbox_commercial_data();

  if exists (
    select 1 from public.contacts
    where id = '5a999999-0000-4000-8000-000000000008'
  ) then
    raise exception 'Sandbox reset retained non-sample practice data';
  end if;

  if not exists (
    select 1 from public.contacts
    where id = '5a000000-0000-4000-8000-000000000003'
  ) or not exists (
    select 1 from public.opportunities
    where id = '5a000000-0000-4000-8000-000000000005'
  ) or not exists (
    select 1 from public.next_actions
    where id = '5a000000-0000-4000-8000-000000000007'
  ) or not exists (
    select 1 from public.field_visits
    where id = '5a000000-0000-4000-8000-000000000008'
  ) then
    raise exception 'Sandbox reset removed the permanent sample journey';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000020', true);

do $$
declare
  review_decision_id bigint;
  normal_facility_id uuid;
  second_normal_facility_id uuid;
  ordinary_visit_id uuid;
  visit_mode text;
begin
  select facility.id into normal_facility_id
  from public.facilities facility
  where facility.archived_at is null
    and not facility.is_sample
  order by facility.acqsc_site_id
  limit 1;

  select facility.id into second_normal_facility_id
  from public.facilities facility
  where facility.archived_at is null
    and not facility.is_sample
    and facility.id <> normal_facility_id
  order by facility.acqsc_site_id
  limit 1;

  begin
    update public.field_visits
    set facility_id = normal_facility_id,
        contact_id = null
    where id = '5a000000-0000-4000-8000-000000000008';
    raise exception 'Sample visit crossed into the ordinary Planner boundary';
  exception
    when raise_exception then
      if sqlerrm not like 'Visit facility cannot cross the sample account boundary%' then
        raise;
      end if;
  end;

  if not exists (
    select 1
    from public.field_visits
    where id = '5a000000-0000-4000-8000-000000000008'
      and facility_id = '5a000000-0000-4000-8000-000000000002'
      and contact_id = '5a000000-0000-4000-8000-000000000004'
      and record_mode = 'sandbox'
  ) then
    raise exception 'Rejected sample visit reassignment changed the durable fixture';
  end if;

  insert into public.field_visits (
    facility_id, title, starts_at, ends_at, status, record_mode
  ) values (
    normal_facility_id,
    'Ordinary Planner boundary probe',
    '2026-09-03 10:00:00+10',
    '2026-09-03 10:30:00+10',
    'tentative',
    'sandbox'
  ) returning id, record_mode into ordinary_visit_id, visit_mode;

  if visit_mode <> 'real' then
    raise exception 'Ordinary visit insert was not forced to real mode';
  end if;

  begin
    update public.field_visits
    set facility_id = '5a000000-0000-4000-8000-000000000002'
    where id = ordinary_visit_id;
    raise exception 'Ordinary visit crossed into the sample Planner boundary';
  exception
    when raise_exception then
      if sqlerrm not like 'Visit facility cannot cross the sample account boundary%' then
        raise;
      end if;
  end;

  update public.field_visits
  set facility_id = second_normal_facility_id,
      title = 'Ordinary same-boundary reassignment'
  where id = ordinary_visit_id
  returning record_mode into visit_mode;

  if visit_mode <> 'real' or not exists (
    select 1
    from public.field_visits
    where id = ordinary_visit_id
      and facility_id = second_normal_facility_id
      and title = 'Ordinary same-boundary reassignment'
  ) then
    raise exception 'Ordinary same-boundary visit reassignment failed';
  end if;

  begin
    perform public.start_scoped_account_research(
      '5a000000-0000-4000-8000-000000000001',
      'gpt-boundary-test'
    );
    raise exception 'Sample provider research was accepted';
  exception
    when raise_exception then
      if sqlerrm not like 'Research is unavailable for sample accounts%' then
        raise;
      end if;
  end;

  select decision.id into review_decision_id
  from public.facility_match_decisions decision
  where decision.status in ('review_required', 'unmatched')
    and not exists (
      select 1
      from public.facility_match_candidates candidate
      where candidate.decision_id = decision.id
    )
  order by decision.id
  limit 1;

  if review_decision_id is null then
    raise exception 'An unmatched facility decision is required for sample review-boundary verification';
  end if;

  begin
    perform public.review_facility_match(
      review_decision_id,
      'confirm',
      '5a000000-0000-4000-8000-000000000002',
      'Sample boundary verification'
    );
    raise exception 'Manual match review accepted the sample facility';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample facilities%' then
        raise;
      end if;
  end;
end;
$$;

reset role;

do $$
declare
  boundary_source_file constant uuid := '5a999999-0000-4000-8000-000000000010';
  boundary_source_record bigint;
  authoritative_source_record bigint;
  authoritative_facility_source_record bigint;
  authoritative_provider uuid;
  authoritative_facility uuid;
  authoritative_research_job constant uuid := '5a999999-0000-4000-8000-000000000020';
  authoritative_intelligence_source constant uuid := '5a999999-0000-4000-8000-000000000021';
  authoritative_intelligence_claim constant uuid := '5a999999-0000-4000-8000-000000000022';
begin
  begin
    insert into public.account_research_jobs (
      provider_id, model, created_by
    ) values (
      '5a000000-0000-4000-8000-000000000001',
      'direct-boundary-test',
      '10000000-0000-4000-8000-000000000020'
    );
    raise exception 'Direct sample research job insert was accepted';
  exception
    when raise_exception then
      if sqlerrm not like 'Research is unavailable for sample accounts%' then
        raise;
      end if;
  end;

  insert into public.source_files (
    id, dataset_code, title, publisher, file_name, sha256, schema_version
  ) values (
    boundary_source_file,
    'sample_boundary_test',
    'Sample boundary test source',
    'Karrot test suite',
    'sample-boundary-test.json',
    repeat('a', 64),
    'test-v1'
  );

  insert into public.source_records (
    source_file_id, sheet_name, row_number, row_hash, raw_data
  ) values (
    boundary_source_file,
    'Boundary',
    1,
    repeat('b', 64),
    '{}'::jsonb
  ) returning id into boundary_source_record;

  begin
    insert into public.provider_snapshots (
      provider_id, source_file_id, source_record_id, observed_at,
      entity_name, business_name
    ) values (
      '5a000000-0000-4000-8000-000000000001',
      boundary_source_file,
      boundary_source_record,
      now(),
      'Sample Oscorp Retirement Home',
      'Sample Oscorp Retirement Home'
    );
    raise exception 'Provider Register snapshot accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample providers%' then
        raise;
      end if;
  end;

  begin
    insert into public.provider_aliases (
      provider_id, source_file_id, source_record_id,
      alias_type, alias, normalized_alias
    ) values (
      '5a000000-0000-4000-8000-000000000001',
      boundary_source_file,
      boundary_source_record,
      'business_name',
      'Sample Oscorp source alias',
      'sample oscorp source alias'
    );
    raise exception 'Provider source alias accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample providers%' then
        raise;
      end if;
  end;

  begin
    insert into public.provider_service_types (
      provider_id, source_file_id, source_record_id,
      registration_category, service_type
    ) values (
      '5a000000-0000-4000-8000-000000000001',
      boundary_source_file,
      boundary_source_record,
      'Sample boundary category',
      'Sample boundary service'
    );
    raise exception 'Provider source service type accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample providers%' then
        raise;
      end if;
  end;

  begin
    insert into public.provider_lgas (
      provider_id, source_file_id, source_record_id,
      registration_category, lga
    ) values (
      '5a000000-0000-4000-8000-000000000001',
      boundary_source_file,
      boundary_source_record,
      'Sample boundary category',
      'Sample boundary LGA'
    );
    raise exception 'Provider source LGA accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample providers%' then
        raise;
      end if;
  end;

  begin
    insert into public.provider_regulatory_notices (
      provider_id, source_file_id, source_record_id,
      status, notice_type, detail
    ) values (
      '5a000000-0000-4000-8000-000000000001',
      boundary_source_file,
      boundary_source_record,
      'open',
      'Sample boundary notice',
      'This row must be rejected.'
    );
    raise exception 'Provider regulatory notice accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample providers%' then
        raise;
      end if;
  end;

  select provider.id, facility.id
  into authoritative_provider, authoritative_facility
  from public.facilities facility
  join public.providers provider on provider.id = facility.provider_id
  where provider.archived_at is null
    and facility.archived_at is null
    and not provider.is_sample
    and not facility.is_sample
  order by provider.abn, facility.acqsc_site_id
  limit 1;

  insert into public.source_records (
    source_file_id, sheet_name, row_number, row_hash, raw_data
  ) values (
    boundary_source_file,
    'Boundary',
    2,
    repeat('c', 64),
    '{}'::jsonb
  ) returning id into authoritative_source_record;

  insert into public.provider_snapshots (
    provider_id, source_file_id, source_record_id, observed_at,
    entity_name, business_name
  )
  select
    provider.id,
    boundary_source_file,
    authoritative_source_record,
    now(),
    provider.entity_name,
    provider.business_name
  from public.providers provider
  where provider.id = authoritative_provider;

  if not exists (
    select 1
    from public.provider_snapshots snapshot
    where snapshot.provider_id = authoritative_provider
      and snapshot.source_record_id = authoritative_source_record
  ) then
    raise exception 'Provider source guard blocked an authoritative provider import';
  end if;

  insert into public.source_records (
    source_file_id, sheet_name, row_number, row_hash, raw_data
  ) values (
    boundary_source_file,
    'Boundary',
    3,
    repeat('d', 64),
    '{}'::jsonb
  ) returning id into authoritative_facility_source_record;

  begin
    insert into public.facility_snapshots (
      facility_id, provider_id, source_file_id, source_record_id,
      observed_at, acqsc_site_id, name, street, suburb, state,
      postcode, full_address
    )
    select
      facility.id,
      '5a000000-0000-4000-8000-000000000001',
      boundary_source_file,
      authoritative_facility_source_record,
      now(),
      facility.acqsc_site_id,
      facility.name,
      facility.street,
      facility.suburb,
      facility.state,
      facility.postcode,
      facility.full_address
    from public.facilities facility
    where facility.id = authoritative_facility;
    raise exception 'Facility snapshot accepted a sample provider for an authoritative facility';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample providers%' then
        raise;
      end if;
  end;

  insert into public.facility_snapshots (
    facility_id, provider_id, source_file_id, source_record_id,
    observed_at, acqsc_site_id, name, street, suburb, state,
    postcode, full_address
  )
  select
    facility.id,
    facility.provider_id,
    boundary_source_file,
    authoritative_facility_source_record,
    now(),
    facility.acqsc_site_id,
    facility.name,
    facility.street,
    facility.suburb,
    facility.state,
    facility.postcode,
    facility.full_address
  from public.facilities facility
  where facility.id = authoritative_facility;

  if not exists (
    select 1
    from public.facility_snapshots snapshot
    where snapshot.facility_id = authoritative_facility
      and snapshot.provider_id = authoritative_provider
      and snapshot.source_record_id = authoritative_facility_source_record
  ) then
    raise exception 'Facility source guards blocked an authoritative facility import';
  end if;

  insert into public.account_research_jobs (
    id, provider_id, facility_id, research_scope, status, model, created_by
  ) values (
    authoritative_research_job,
    authoritative_provider,
    authoritative_facility,
    'facility',
    'completed',
    'boundary-positive-control',
    '10000000-0000-4000-8000-000000000020'
  );

  insert into public.intelligence_sources (
    id, provider_id, research_job_id, title, url, source_type, created_by
  ) values (
    authoritative_intelligence_source,
    authoritative_provider,
    authoritative_research_job,
    'Authoritative research boundary source',
    'https://example.invalid/authoritative-boundary-source',
    'official_provider',
    '10000000-0000-4000-8000-000000000020'
  );

  insert into public.intelligence_claims (
    id, provider_id, research_job_id, category, section, statement,
    epistemic_state, confidence, observed_at, review_status, review_note,
    reviewed_by, reviewed_at, created_by
  ) values (
    authoritative_intelligence_claim,
    authoritative_provider,
    authoritative_research_job,
    'signal',
    'Boundary verification',
    'Authoritative research memory remains available.',
    'known',
    'high',
    current_date,
    'approved',
    'Positive boundary control',
    '10000000-0000-4000-8000-000000000020',
    now(),
    '10000000-0000-4000-8000-000000000020'
  );

  insert into public.intelligence_claim_sources (claim_id, source_id)
  values (authoritative_intelligence_claim, authoritative_intelligence_source);

  insert into public.commercial_account_facts (
    id, provider_id, facility_id, source_claim_id, category, statement,
    epistemic_state, confidence, approved_by
  ) values (
    '5a999999-0000-4000-8000-000000000023',
    authoritative_provider,
    authoritative_facility,
    authoritative_intelligence_claim,
    'signal',
    'Authoritative research memory remains available.',
    'known',
    'high',
    '10000000-0000-4000-8000-000000000020'
  );

  insert into public.intelligence_review_events (
    claim_id, provider_id, action, previous_status,
    resulting_statement, note, reviewed_by
  ) values (
    authoritative_intelligence_claim,
    authoritative_provider,
    'approved',
    'pending',
    'Authoritative research memory remains available.',
    'Positive boundary control',
    '10000000-0000-4000-8000-000000000020'
  );

  if not exists (
    select 1
    from public.intelligence_sources source
    join public.intelligence_claim_sources link on link.source_id = source.id
    join public.intelligence_claims claim on claim.id = link.claim_id
    join public.commercial_account_facts fact on fact.source_claim_id = claim.id
    join public.intelligence_review_events review on review.claim_id = claim.id
    where source.id = authoritative_intelligence_source
      and claim.id = authoritative_intelligence_claim
      and source.provider_id = authoritative_provider
      and claim.provider_id = authoritative_provider
      and fact.provider_id = authoritative_provider
      and fact.facility_id = authoritative_facility
      and review.provider_id = authoritative_provider
  ) then
    raise exception 'Research-memory guards blocked an authoritative research and review flow';
  end if;

  begin
    insert into public.intelligence_sources (
      id, provider_id, research_job_id, title, url, source_type, created_by
    ) values (
      '5a999999-0000-4000-8000-000000000024',
      '5a000000-0000-4000-8000-000000000001',
      authoritative_research_job,
      'Rejected sample research source',
      'https://example.invalid/rejected-sample-source',
      'other',
      '10000000-0000-4000-8000-000000000020'
    );
    raise exception 'Direct intelligence source accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Research is unavailable for sample accounts%' then
        raise;
      end if;
  end;

  begin
    insert into public.intelligence_claims (
      id, provider_id, research_job_id, category, section, statement,
      epistemic_state, confidence, created_by
    ) values (
      '5a999999-0000-4000-8000-000000000025',
      '5a000000-0000-4000-8000-000000000001',
      authoritative_research_job,
      'signal',
      'Rejected sample memory',
      'This sample claim must not be stored.',
      'unknown',
      'low',
      '10000000-0000-4000-8000-000000000020'
    );
    raise exception 'Direct intelligence claim accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Research is unavailable for sample accounts%' then
        raise;
      end if;
  end;

  begin
    insert into public.commercial_account_facts (
      id, provider_id, source_claim_id, category, statement,
      epistemic_state, confidence, approved_by
    ) values (
      '5a999999-0000-4000-8000-000000000026',
      '5a000000-0000-4000-8000-000000000001',
      authoritative_intelligence_claim,
      'signal',
      'This sample fact must not be stored.',
      'known',
      'high',
      '10000000-0000-4000-8000-000000000020'
    );
    raise exception 'Direct commercial fact accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Research is unavailable for sample accounts%' then
        raise;
      end if;
  end;

  begin
    insert into public.commercial_account_facts (
      id, provider_id, facility_id, source_claim_id, category, statement,
      epistemic_state, confidence, approved_by
    ) values (
      '5a999999-0000-4000-8000-000000000027',
      authoritative_provider,
      '5a000000-0000-4000-8000-000000000002',
      authoritative_intelligence_claim,
      'signal',
      'This sample-facility fact must not be stored.',
      'known',
      'high',
      '10000000-0000-4000-8000-000000000020'
    );
    raise exception 'Direct commercial fact accepted the sample facility';
  exception
    when raise_exception then
      if sqlerrm not like 'Research is unavailable for sample accounts%' then
        raise;
      end if;
  end;

  begin
    insert into public.intelligence_review_events (
      claim_id, provider_id, action, previous_status,
      resulting_statement, note, reviewed_by
    ) values (
      authoritative_intelligence_claim,
      '5a000000-0000-4000-8000-000000000001',
      'approved',
      'pending',
      'This sample review must not be stored.',
      'Rejected sample review',
      '10000000-0000-4000-8000-000000000020'
    );
    raise exception 'Direct intelligence review accepted the sample provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Research is unavailable for sample accounts%' then
        raise;
      end if;
  end;

  begin
    insert into public.facility_match_decisions (
      source_record_id, source_file_id, dataset_code, facility_id,
      status, match_method
    ) values (
      boundary_source_record,
      boundary_source_file,
      'care_minutes',
      '5a000000-0000-4000-8000-000000000002',
      'confirmed',
      'direct-boundary-test'
    );
    raise exception 'Direct match decision accepted the sample facility';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample facilities%' then
        raise;
      end if;
  end;

  begin
    insert into public.facility_snapshots (
      facility_id, provider_id, source_file_id, source_record_id,
      observed_at, acqsc_site_id, name, street, suburb, state,
      postcode, full_address
    ) values (
      '5a000000-0000-4000-8000-000000000002',
      '5a000000-0000-4000-8000-000000000001',
      boundary_source_file,
      boundary_source_record,
      now(),
      'SAMPLE-OSCORP-001',
      'Sample Queens Uncle Ben House',
      'Bennelong Point',
      'Sydney',
      'NSW',
      '2000',
      'Bennelong Point, Sydney NSW 2000'
    );
    raise exception 'Provider Register snapshot accepted the sample facility';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample facilities%' then
        raise;
      end if;
  end;

  begin
    insert into public.care_minutes_snapshots (
      facility_id, source_file_id, source_record_id,
      period_start, period_end, observed_home_name,
      observed_provider_name, state
    ) values (
      '5a000000-0000-4000-8000-000000000002',
      boundary_source_file,
      boundary_source_record,
      '2026-01-01',
      '2026-03-31',
      'Sample Queens Uncle Ben House',
      'Sample Oscorp Retirement Home',
      'NSW'
    );
    raise exception 'Care-minutes snapshot accepted the sample facility';
  exception
    when raise_exception then
      if sqlerrm not like 'Authoritative source data cannot target sample facilities%' then
        raise;
      end if;
  end;
end;
$$;

rollback;

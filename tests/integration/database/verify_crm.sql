\set ON_ERROR_STOP on

begin;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'account_research_jobs', 'intelligence_sources', 'intelligence_claims',
    'intelligence_claim_sources', 'commercial_account_facts',
    'intelligence_review_events'
  ] loop
    if has_table_privilege('anon', 'public.' || relation_name, 'SELECT')
      or has_table_privilege('authenticated', 'public.' || relation_name, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || relation_name, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || relation_name, 'DELETE')
      or has_table_privilege('authenticated', 'public.' || relation_name, 'TRUNCATE') then
      raise exception 'Unsafe intelligence ACL on %', relation_name;
    end if;
    if not has_table_privilege('service_role', 'public.' || relation_name, 'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'Service role is missing administrative intelligence access on %', relation_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.attach_account_research_response(uuid,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.attach_account_research_response(uuid,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.attach_account_research_response(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Unsafe background response attachment RPC ACL';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-test@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'editor-test@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'viewer-test@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1 from public.profiles
    where id in (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003'
    ) and role <> 'viewer'
  ) then
    raise exception 'New authentication users did not default to viewer';
  end if;
end;
$$;

update public.profiles set role = 'owner' where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'editor' where id = '10000000-0000-4000-8000-000000000002';
update public.profiles set role = 'viewer' where id = '10000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

do $$
begin
  if (select count(*) from public.v_provider_overview where search_text ilike '%randwick%') < 5 then
    raise exception 'Provider search did not include providers operating Randwick facilities';
  end if;
end;
$$;

do $$
declare
  provider_a uuid;
  provider_b uuid;
  facility_a uuid;
  facility_b uuid;
  created_opportunity_id uuid;
begin
  select id into provider_a from public.providers where not is_sample order by abn limit 1;
  select id into provider_b from public.providers where id <> provider_a and not is_sample order by abn limit 1;
  select id into facility_a from public.facilities where provider_id = provider_a order by acqsc_site_id limit 1;
  select id into facility_b from public.facilities where provider_id = provider_b order by acqsc_site_id limit 1;

  insert into public.contacts (provider_id, facility_id, full_name)
  values (provider_a, facility_a, 'Integration Test Contact');

  if not exists (
    select 1 from public.contacts
    where provider_id = provider_a
      and full_name = 'Integration Test Contact'
      and created_by = auth.uid()
  ) then
    raise exception 'Authenticated contact creator was not recorded from auth.uid()';
  end if;

  if not exists (
    select 1 from public.v_global_search
    where object_type = 'contact'
      and title = 'Integration Test Contact'
      and provider_id = provider_a
  ) then
    raise exception 'Global search did not expose the new contact with provider context';
  end if;

  begin
    insert into public.contacts (provider_id, facility_id, full_name)
    values (provider_a, facility_b, 'Invalid Cross-provider Contact');
    raise exception 'Cross-provider contact validation did not fire';
  exception
    when raise_exception then
      if sqlerrm not like 'Contact facility must belong%' then
        raise;
      end if;
  end;

  insert into public.opportunities (
    provider_id, name, stage_id, owner_id
  ) values (
    provider_a,
    'Integration Test Win',
    '00000000-0000-4000-8000-000000000011',
    auth.uid()
  ) returning id into created_opportunity_id;

  if not exists (
    select 1 from public.opportunity_stage_history osh
    where osh.opportunity_id = created_opportunity_id
      and osh.to_stage_id = '00000000-0000-4000-8000-000000000011'
      and osh.changed_by = auth.uid()
  ) then
    raise exception 'Closed-won insertion did not create attributed stage history';
  end if;

  if not exists (
    select 1 from public.customer_relationships
    where provider_id = provider_a and originating_opportunity_id = created_opportunity_id
  ) then
    raise exception 'Closed-won insertion did not create a customer relationship';
  end if;

  update public.customer_relationships
  set status = 'churned'
  where provider_id = provider_a;

  update public.opportunities
  set stage_id = stage_id
  where id = created_opportunity_id;

  if not exists (
    select 1 from public.customer_relationships
    where provider_id = provider_a and status = 'churned'
  ) then
    raise exception 'Unchanged won stage reactivated a churned customer';
  end if;

  update public.opportunities
  set stage_id = '00000000-0000-4000-8000-000000000001'
  where id = created_opportunity_id;

  if exists (
    select 1 from public.opportunities
    where id = created_opportunity_id
      and (closed_won_at is not null or closed_lost_at is not null)
  ) then
    raise exception 'Reopened opportunity retained a terminal timestamp';
  end if;
end;
$$;

do $$
declare
  provider_id uuid;
begin
  select id into provider_id from public.providers where not is_sample order by abn limit 1;
  begin
    insert into public.contacts (provider_id, full_name, created_by)
    values (
      provider_id,
      'Spoofed Creator Must Fail',
      '10000000-0000-4000-8000-000000000001'
    );
    raise exception 'Authenticated user supplied a protected creator column';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.opportunities
    set closed_won_at = now();
    raise exception 'Authenticated user directly changed a derived lifecycle timestamp';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles set role = 'owner' where id = auth.uid();
    raise exception 'Editor changed their own protected role';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  provider_id uuid;
  job_id uuid;
  v_claim_id uuid;
begin
  select id into provider_id from public.providers where not is_sample order by abn limit 1;
  job_id := public.start_account_research(
    provider_id,
    'integration-test-model',
    '{"workflow":"research_account"}'::jsonb,
    '{"provider":"fixture"}'::jsonb
  );
  perform public.complete_account_research(
    job_id,
    'response_fixture',
    '{"input_tokens":10,"output_tokens":10}'::jsonb,
    '[{"title":"Official leadership","publisher":"Fixture provider","url":"https://example.invalid/leadership","source_type":"official_provider","published_at":"2026-08-18","excerpt":"Leadership fixture"}]'::jsonb,
    '[{"category":"person","section":"People Worth Investigating","statement":"Test Person is Director of Clinical Services.","epistemic_state":"known","confidence":"high","person_name":"Test Person","person_title":"Director of Clinical Services","potential_relevance":"Clinical stakeholder","observed_at":"2026-08-18","source_urls":["https://example.invalid/leadership"]},{"category":"organisation","section":"Organisation","statement":"Unsupported assertion supplied as known.","epistemic_state":"known","confidence":"high","person_name":null,"person_title":null,"potential_relevance":null,"observed_at":"2026-08-18","source_urls":[]},{"category":"organisation","section":"Organisation","statement":"Undated assertion supplied as known.","epistemic_state":"known","confidence":"high","person_name":null,"person_title":null,"potential_relevance":null,"observed_at":null,"source_urls":["https://example.invalid/leadership"]}]'::jsonb
  );

  select id into v_claim_id
  from public.intelligence_claims
  where research_job_id = job_id
    and statement = 'Test Person is Director of Clinical Services.';
  if v_claim_id is null or not exists (
    select 1
    from public.intelligence_claim_sources ics
    where ics.claim_id = v_claim_id
  ) then
    raise exception 'Research completion did not preserve claim-to-source evidence';
  end if;
  if not exists (
    select 1 from public.intelligence_claims
    where research_job_id = job_id
      and statement = 'Unsupported assertion supplied as known.'
      and epistemic_state = 'unknown'
      and confidence = 'low'
  ) then
    raise exception 'Unsupported known claim was not downgraded at the database boundary';
  end if;
  if not exists (
    select 1 from public.intelligence_claims
    where research_job_id = job_id
      and statement = 'Undated assertion supplied as known.'
      and epistemic_state = 'unknown'
      and confidence = 'low'
  ) then
    raise exception 'Undated known claim was not downgraded at the database boundary';
  end if;

  perform public.review_intelligence_claim(v_claim_id, 'approved', null, 'Source checked');
  if not exists (
    select 1 from public.commercial_account_facts
    where source_claim_id = v_claim_id and approved_by = auth.uid() and is_active
  ) then
    raise exception 'Approved intelligence did not enter commercial truth';
  end if;
  if not exists (
    select 1 from public.intelligence_review_events
    where claim_id = v_claim_id and action = 'approved' and reviewed_by = auth.uid()
  ) then
    raise exception 'Intelligence approval was not attributed in audit history';
  end if;

  begin
    update public.intelligence_claims set review_status = 'rejected' where id = v_claim_id;
    raise exception 'Authenticated editor directly changed protected intelligence review state';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  v_provider_id uuid;
  v_job_id uuid;
begin
  select id into v_provider_id
  from public.providers provider
  where not provider.is_sample
    and not exists (
      select 1
      from public.account_research_jobs job
      where job.provider_id = provider.id
    )
  order by provider.abn desc
  limit 1;

  v_job_id := public.start_account_research(
    v_provider_id,
    'background-integration-test-model',
    '{"workflow":"research_account"}'::jsonb,
    '{"provider":"background-fixture"}'::jsonb
  );

  begin
    perform public.attach_account_research_response(v_job_id, '   ');
    raise exception 'Background response attachment accepted a blank response ID';
  exception
    when invalid_parameter_value then null;
  end;

  perform public.attach_account_research_response(
    v_job_id,
    ' response_fixture_background '
  );
  perform public.attach_account_research_response(
    v_job_id,
    'response_fixture_background'
  );

  if not exists (
    select 1
    from public.account_research_jobs job
    where job.id = v_job_id
      and job.response_id = 'response_fixture_background'
      and job.status = 'running'
      and job.completed_at is null
  ) then
    raise exception 'Background response attachment did not preserve the running job state';
  end if;

  begin
    perform public.attach_account_research_response(
      v_job_id,
      'response_fixture_conflict'
    );
    raise exception 'Background response attachment accepted a conflicting response ID';
  exception
    when raise_exception then
      if sqlerrm not like 'Research job is already attached to a different response%' then
        raise;
      end if;
  end;

  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000003',
    true
  );
  begin
    perform public.attach_account_research_response(
      v_job_id,
      'response_fixture_background'
    );
    raise exception 'A non-owner who did not create the job attached its response';
  exception
    when insufficient_privilege then null;
  end;

  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000001',
    true
  );
  perform public.attach_account_research_response(
    v_job_id,
    'response_fixture_background'
  );

  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-4000-8000-000000000002',
    true
  );
  perform public.fail_account_research(
    v_job_id,
    'background_fixture_closed',
    'Background response attachment fixture closed after verification'
  );

  begin
    perform public.attach_account_research_response(
      v_job_id,
      'response_fixture_background'
    );
    raise exception 'Background response attachment accepted a non-running job';
  exception
    when raise_exception then
      if sqlerrm not like 'Research job is not running%' then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_provider_id uuid;
  v_facility_id uuid;
  v_other_provider_id uuid;
  v_other_facility_id uuid;
  v_first_job_id uuid;
  v_refresh_job_id uuid;
  v_failed_job_id uuid;
  v_researching_job_id uuid;
  v_approved_claim_id uuid;
  v_rejected_claim_id uuid;
  v_corrected_claim_id uuid;
  v_hypothesis_claim_id uuid;
  v_unknown_claim_id uuid;
begin
  select f.provider_id, f.id into v_provider_id, v_facility_id
  from public.facilities f
  join public.providers p on p.id = f.provider_id
  where f.archived_at is null and p.archived_at is null
    and not f.is_sample and not p.is_sample
  order by p.abn, f.acqsc_site_id
  limit 1;
  select f.provider_id, f.id into v_other_provider_id, v_other_facility_id
  from public.facilities f
  join public.providers p on p.id = f.provider_id
  where f.provider_id <> v_provider_id
    and f.archived_at is null
    and p.archived_at is null
    and not f.is_sample and not p.is_sample
  order by f.acqsc_site_id
  limit 1;

  v_first_job_id := public.start_scoped_account_research(
    v_provider_id,
    'facility-integration-test-model',
    v_facility_id,
    '{"workflow":"research_facility"}'::jsonb,
    '{"provider":"fixture","facility":"fixture"}'::jsonb
  );
  if not exists (
    select 1 from public.account_research_jobs job
    where job.id = v_first_job_id
      and job.provider_id = v_provider_id
      and job.facility_id = v_facility_id
      and job.research_scope = 'facility'
      and job.status = 'running'
  ) then
    raise exception 'Scoped research did not persist its provider and facility target';
  end if;

  begin
    perform public.start_scoped_account_research(
      v_provider_id,
      'cross-provider-test-model',
      v_other_facility_id,
      '{}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'Scoped research accepted a facility belonging to another provider';
  exception
    when raise_exception then
      if sqlerrm not like 'Facility not found for this provider%' then
        raise;
      end if;
  end;

  begin
    perform public.start_scoped_account_research(
      v_provider_id,
      'duplicate-facility-test-model',
      v_facility_id,
      '{}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'Scoped research accepted a duplicate active facility run';
  exception
    when raise_exception then
      if sqlerrm not like 'Research is already running for this facility.%' then
        raise;
      end if;
  end;

  perform public.complete_account_research(
    v_first_job_id,
    'facility_response_fixture_1',
    '{"input_tokens":20,"output_tokens":10}'::jsonb,
    '[{"title":"Facility leadership","publisher":"Fixture provider","url":"https://example.invalid/facility-leadership","source_type":"official_provider","published_at":"2026-08-20","updated_at":"2026-08-22","excerpt":"Facility leadership fixture"}]'::jsonb,
    '[{"category":"person","section":"People Worth Investigating","statement":"Facility Test Person is the Facility Manager.","epistemic_state":"known","confidence":"high","person_name":"Facility Test Person","person_title":"Facility Manager","potential_relevance":"Potentially relevant facility stakeholder","observed_at":"2026-08-23","source_urls":["https://example.invalid/facility-leadership"]},{"category":"organisation","section":"Organisation","statement":"The fixture provider operates the selected facility.","epistemic_state":"known","confidence":"high","person_name":null,"person_title":null,"potential_relevance":null,"observed_at":"2026-08-23","source_urls":["https://example.invalid/facility-leadership"]},{"category":"hypothesis","section":"What We Think","statement":"A facility workflow may be worth testing in discovery.","epistemic_state":"hypothesis","confidence":"medium","person_name":null,"person_title":null,"potential_relevance":null,"observed_at":null,"source_urls":[]},{"category":"gap","section":"Research Gaps","statement":"The facility clinical system remains unverified.","epistemic_state":"unknown","confidence":"low","person_name":null,"person_title":null,"potential_relevance":null,"observed_at":null,"source_urls":[]}]'::jsonb
  );

  if not exists (
    select 1 from public.intelligence_sources
    where research_job_id = v_first_job_id
      and source_updated_at = date '2026-08-22'
  ) then
    raise exception 'Scoped research did not preserve the source update date';
  end if;

  select id into v_approved_claim_id
  from public.intelligence_claims
  where research_job_id = v_first_job_id
    and statement = 'Facility Test Person is the Facility Manager.';
  select id into v_rejected_claim_id
  from public.intelligence_claims
  where research_job_id = v_first_job_id
    and statement = 'The fixture provider operates the selected facility.';
  select id into v_hypothesis_claim_id
  from public.intelligence_claims
  where research_job_id = v_first_job_id
    and epistemic_state = 'hypothesis';
  select id into v_unknown_claim_id
  from public.intelligence_claims
  where research_job_id = v_first_job_id
    and epistemic_state = 'unknown';

  perform public.review_intelligence_claim(
    v_approved_claim_id,
    'approved',
    null,
    'Facility-scoped source checked'
  );
  perform public.review_intelligence_claim(
    v_rejected_claim_id,
    'rejected',
    null,
    'Rejected claims must remain outside commercial context'
  );
  if not exists (
    select 1 from public.commercial_account_facts fact
    where fact.source_claim_id = v_approved_claim_id
      and fact.provider_id = v_provider_id
      and fact.facility_id = v_facility_id
      and fact.statement = 'Facility Test Person is the Facility Manager.'
      and fact.is_active
  ) then
    raise exception 'Approved facility intelligence did not preserve its facility scope in commercial truth';
  end if;
  if exists (
    select 1 from public.commercial_account_facts
    where source_claim_id = v_rejected_claim_id
  ) or not exists (
    select 1 from public.intelligence_claims
    where id = v_rejected_claim_id and review_status = 'rejected'
  ) or not exists (
    select 1 from public.intelligence_review_events
    where claim_id = v_rejected_claim_id
      and action = 'rejected'
      and resulting_statement is null
  ) then
    raise exception 'Rejected facility intelligence remained eligible for commercial context';
  end if;

  v_refresh_job_id := public.start_scoped_account_research(
    v_provider_id,
    'facility-integration-test-model',
    v_facility_id,
    '{"workflow":"research_facility","refresh":true}'::jsonb,
    '{"provider":"fixture","facility":"fixture"}'::jsonb
  );
  perform public.complete_account_research(
    v_refresh_job_id,
    'facility_response_fixture_2',
    '{"input_tokens":20,"output_tokens":10}'::jsonb,
    '[{"title":"Facility refresh","publisher":"Fixture provider","url":"https://example.invalid/facility-refresh","source_type":"official_provider","published_at":"2026-08-23","updated_at":null,"excerpt":"Facility refresh fixture"}]'::jsonb,
    '[{"category":"signal","section":"Recent Signals","statement":"The facility refresh produced a new supported signal.","epistemic_state":"known","confidence":"high","person_name":null,"person_title":null,"potential_relevance":null,"observed_at":"2026-08-23","source_urls":["https://example.invalid/facility-refresh"]}]'::jsonb
  );

  select id into v_corrected_claim_id
  from public.intelligence_claims
  where research_job_id = v_refresh_job_id
    and statement = 'The facility refresh produced a new supported signal.';
  perform public.review_intelligence_claim(
    v_corrected_claim_id,
    'corrected',
    'The facility refresh produced a corrected, supported signal.',
    'Correction checked against the facility source'
  );
  if not exists (
    select 1 from public.commercial_account_facts fact
    where fact.source_claim_id = v_corrected_claim_id
      and fact.provider_id = v_provider_id
      and fact.facility_id = v_facility_id
      and fact.statement = 'The facility refresh produced a corrected, supported signal.'
      and fact.is_active
  ) or not exists (
    select 1 from public.intelligence_claims claim
    where claim.id = v_corrected_claim_id
      and claim.statement = 'The facility refresh produced a new supported signal.'
      and claim.review_status = 'corrected'
  ) or not exists (
    select 1 from public.intelligence_review_events event
    where event.claim_id = v_corrected_claim_id
      and event.action = 'corrected'
      and event.resulting_statement = 'The facility refresh produced a corrected, supported signal.'
  ) then
    raise exception 'Corrected facility intelligence did not preserve safe source and commercial context';
  end if;

  if (
    select count(*) from public.account_research_jobs
    where id in (v_first_job_id, v_refresh_job_id) and status = 'completed'
  ) <> 2 or not exists (
    select 1 from public.intelligence_claims
    where research_job_id = v_first_job_id
      and statement = 'Facility Test Person is the Facility Manager.'
  ) or not exists (
    select 1 from public.intelligence_claims
    where research_job_id = v_refresh_job_id
      and statement = 'The facility refresh produced a new supported signal.'
  ) then
    raise exception 'Facility refresh did not preserve distinct completed run history and claims';
  end if;

  v_failed_job_id := public.start_scoped_account_research(
    v_provider_id,
    'facility-integration-test-model',
    v_facility_id,
    '{"workflow":"research_facility","refresh":true}'::jsonb,
    '{"provider":"fixture","facility":"fixture"}'::jsonb
  );
  perform public.fail_account_research(
    v_failed_job_id,
    'integration_failure',
    'Expected failed facility refresh'
  );
  if not exists (
    select 1 from public.account_research_jobs
    where id = v_failed_job_id
      and status = 'failed'
      and error_code = 'integration_failure'
      and completed_at is not null
  ) or (
    select count(*) from public.intelligence_claims
    where research_job_id in (v_first_job_id, v_refresh_job_id)
  ) <> 5 or exists (
    select 1 from public.intelligence_claims
    where research_job_id = v_failed_job_id
  ) then
    raise exception 'A failed facility refresh did not preserve prior intelligence cleanly';
  end if;

  begin
    perform public.fail_account_research(
      v_refresh_job_id,
      'invalid_transition',
      'A completed run must remain completed'
    );
    raise exception 'A completed research job was allowed to transition to failed';
  exception
    when raise_exception then
      if sqlerrm not like 'Research job is not running%' then
        raise;
      end if;
  end;
  if not exists (
    select 1 from public.account_research_jobs
    where id = v_refresh_job_id and status = 'completed'
  ) then
    raise exception 'The failed-transition guard mutated completed research history';
  end if;

  begin
    perform public.review_intelligence_claim(
      v_hypothesis_claim_id,
      'approved',
      null,
      'A hypothesis must not be promoted'
    );
    raise exception 'A hypothesis was promoted into commercial knowledge';
  exception
    when raise_exception then
      if sqlerrm not like 'Only supported known claims can enter commercial knowledge%' then
        raise;
      end if;
  end;
  begin
    perform public.review_intelligence_claim(
      v_unknown_claim_id,
      'corrected',
      'A corrected unknown still requires supporting evidence.',
      'An unknown must not be promoted'
    );
    raise exception 'An unknown was promoted into commercial knowledge';
  exception
    when raise_exception then
      if sqlerrm not like 'Only supported known claims can enter commercial knowledge%' then
        raise;
      end if;
  end;
  if exists (
    select 1 from public.commercial_account_facts
    where source_claim_id in (v_hypothesis_claim_id, v_unknown_claim_id)
  ) or exists (
    select 1 from public.intelligence_claims
    where id in (v_hypothesis_claim_id, v_unknown_claim_id)
      and review_status <> 'pending'
  ) then
    raise exception 'Non-known intelligence crossed the commercial-knowledge boundary';
  end if;

  v_researching_job_id := public.start_scoped_account_research(
    v_other_provider_id,
    'coverage-running-test-model',
    v_other_facility_id,
    '{"workflow":"research_facility","coverage_fixture":true}'::jsonb,
    '{"provider":"coverage fixture","facility":"coverage fixture"}'::jsonb
  );
  if not exists (
    select 1 from public.account_research_jobs
    where id = v_researching_job_id
      and provider_id = v_other_provider_id
      and facility_id = v_other_facility_id
      and status = 'running'
  ) then
    raise exception 'Coverage fixture did not retain its researching scope';
  end if;
end;
$$;

reset role;

do $$
declare
  facility_id uuid;
  other_provider_id uuid;
  research_facility_id uuid;
  research_provider_id uuid;
  research_other_provider_id uuid;
  provider_completed_count bigint;
  facility_completed_count bigint;
  fresh_count bigint;
  needs_refresh_count bigint;
  researching_count bigint;
  matched_source_record_id bigint;
  other_facility_id uuid;
begin
  update public.account_research_jobs
  set requested_at = case
    when model = 'integration-test-model' then now() - interval '5 minutes'
    when response_id = 'facility_response_fixture_1' then now() - interval '4 minutes'
    when response_id = 'facility_response_fixture_2' then now() - interval '3 minutes'
    when error_code = 'integration_failure' then now() - interval '2 minutes'
    when model = 'coverage-running-test-model' then now() - interval '1 minute'
    else requested_at
  end
  where model in (
    'integration-test-model',
    'facility-integration-test-model',
    'coverage-running-test-model'
  );

  select
    provider_completed,
    facility_completed,
    fresh,
    needs_refresh,
    researching
  into
    provider_completed_count,
    facility_completed_count,
    fresh_count,
    needs_refresh_count,
    researching_count
  from public.research_coverage_snapshot(14, now());
  if provider_completed_count <> 1
    or facility_completed_count <> 1
    or fresh_count <> 1
    or needs_refresh_count <> 1
    or researching_count <> 1 then
    raise exception
      'Research coverage snapshot returned unexpected counts: provider %, facility %, fresh %, refresh %, researching %',
      provider_completed_count,
      facility_completed_count,
      fresh_count,
      needs_refresh_count,
      researching_count;
  end if;

  select f.id, f.provider_id into research_facility_id, research_provider_id
  from public.facilities f
  join public.account_research_jobs job on job.facility_id = f.id
  where job.model = 'facility-integration-test-model'
  order by job.requested_at
  limit 1;
  select p.id into research_other_provider_id
  from public.providers p
  where p.id <> research_provider_id
    and not p.is_sample
  order by p.abn
  limit 1;

  begin
    update public.facilities
    set provider_id = research_other_provider_id
    where id = research_facility_id;
    raise exception 'Facility provider reassignment bypassed scoped-research validation';
  exception
    when raise_exception then
      if sqlerrm not like 'Facility provider cannot change while scoped research memory references the prior provider%' then
        raise;
      end if;
  end;
  if not exists (
    select 1 from public.facilities
    where id = research_facility_id and provider_id = research_provider_id
  ) then
    raise exception 'Blocked research facility reassignment still changed provider scope';
  end if;

  select c.facility_id into facility_id
  from public.contacts c
  where c.full_name = 'Integration Test Contact';
  select p.id into other_provider_id
  from public.providers p
  where p.id <> (select f.provider_id from public.facilities f where f.id = facility_id)
    and not p.is_sample
  order by p.abn
  limit 1;

  begin
    update public.facilities set provider_id = other_provider_id where id = facility_id;
    raise exception 'Facility provider reassignment bypassed dependent-record validation';
  exception
    when raise_exception then
      if sqlerrm not like 'Facility provider cannot change%' then
        raise;
      end if;
  end;

  select s.source_record_id, f.id
  into matched_source_record_id, other_facility_id
  from public.star_rating_snapshots s
  cross join lateral (
    select candidate.id
    from public.facilities candidate
    where candidate.id <> s.facility_id
      and not candidate.is_sample
    order by candidate.acqsc_site_id
    limit 1
  ) f
  order by s.source_record_id
  limit 1;

  begin
    update public.facility_match_decisions
    set facility_id = other_facility_id
    where source_record_id = matched_source_record_id;
    raise exception 'Immutable snapshot match decision was remapped';
  exception
    when raise_exception then
      if sqlerrm not like 'Cannot remap or reject%' then
        raise;
      end if;
  end;

  begin
    update public.pipeline_stages
    set outcome = 'won'
    where id = '00000000-0000-4000-8000-000000000001';
    raise exception 'Referenced pipeline stage outcome changed without lifecycle reconciliation';
  exception
    when raise_exception then
      if sqlerrm not like 'Cannot change the outcome%' then
        raise;
      end if;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$
declare
  v_provider_id uuid;
  v_facility_id uuid;
  review_decision_id bigint;
begin
  select id into v_provider_id from public.providers where not is_sample order by abn limit 1;
  select f.id into v_facility_id
  from public.facilities f
  where f.provider_id = v_provider_id
  order by acqsc_site_id
  limit 1;
  begin
    insert into public.contacts (provider_id, full_name)
    values (v_provider_id, 'Viewer Must Not Write');
    raise exception 'Viewer write policy did not block contact creation';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.start_account_research(v_provider_id, 'viewer-test', '{}'::jsonb, '{}'::jsonb);
    raise exception 'Viewer unexpectedly started account research';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.start_scoped_account_research(
      v_provider_id,
      'viewer-scoped-test',
      v_facility_id,
      '{}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'Viewer unexpectedly started scoped facility research';
  exception
    when insufficient_privilege then null;
  end;

  select id into review_decision_id
  from public.facility_match_decisions
  where status in ('review_required', 'unmatched')
  order by id
  limit 1;
  begin
    perform public.review_facility_match(
      review_decision_id, 'reject', null, 'Viewer must not review matches'
    );
    raise exception 'Viewer unexpectedly reviewed a facility match';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

do $$
declare
  star_decision_id bigint;
  star_source_record_id bigint;
  star_facility_id uuid;
  care_decision_id bigint;
begin
  select decision.id, decision.source_record_id, candidate.facility_id
  into star_decision_id, star_source_record_id, star_facility_id
  from public.facility_match_decisions decision
  join public.facility_match_candidates candidate
    on candidate.decision_id = decision.id and candidate.candidate_rank = 1
  where decision.dataset_code = 'star_ratings'
    and decision.status = 'review_required'
  order by decision.id
  limit 1;

  perform public.review_facility_match(
    star_decision_id, 'confirm', star_facility_id, 'Candidate identity checked against source'
  );

  if not exists (
    select 1 from public.star_rating_snapshots
    where source_record_id = star_source_record_id and facility_id = star_facility_id
  ) then
    raise exception 'Manual Star Rating confirmation did not create a snapshot';
  end if;
  if not exists (
    select 1 from public.facility_match_review_events
    where decision_id = star_decision_id
      and action = 'confirm'
      and reviewed_by = auth.uid()
  ) then
    raise exception 'Manual Star Rating confirmation was not attributed';
  end if;

  select id into care_decision_id
  from public.facility_match_decisions
  where dataset_code = 'care_minutes' and status = 'unmatched'
  order by id
  limit 1;
  perform public.review_facility_match(
    care_decision_id, 'reject', null, 'Source identity has no matching registered home'
  );
  perform public.review_facility_match(
    care_decision_id, 'reset', null, 'Returned to review after reassessment'
  );

  if not exists (
    select 1 from public.facility_match_decisions
    where id = care_decision_id and status = 'review_required' and facility_id is null
  ) then
    raise exception 'Rejected decision was not returned to review';
  end if;
  if (select count(*) from public.facility_match_review_events where decision_id = care_decision_id) <> 2 then
    raise exception 'Reject/reset review history is incomplete';
  end if;
end;
$$;

do $$
declare
  affected_rows integer;
begin
  update public.pipeline_stages set name = name
  where id = '00000000-0000-4000-8000-000000000001';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Editor unexpectedly changed pipeline-stage configuration';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
update public.pipeline_stages set name = name
where id = '00000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    update public.pipeline_stages
    set outcome = 'won'
    where id = '00000000-0000-4000-8000-000000000001';
    raise exception 'Owner directly changed a protected lifecycle outcome';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  test_provider_id uuid;
  real_contact_id uuid;
  sandbox_contact_id uuid;
  real_activity_id uuid;
  real_action_id uuid;
  sandbox_opportunity_id uuid;
begin
  select id into test_provider_id from public.providers where not is_sample order by abn limit 1;
  select id into real_contact_id
  from public.contacts
  where provider_id = test_provider_id and record_mode = 'real'
  order by created_at
  limit 1;

  begin
    insert into public.opportunities (
      provider_id, name, stage_id, owner_id, primary_contact_id, record_mode
    ) values (
      test_provider_id,
      'Cross-mode contact must fail',
      '00000000-0000-4000-8000-000000000001',
      auth.uid(),
      real_contact_id,
      'sandbox'
    );
    raise exception 'Sandbox opportunity linked to a real contact';
  exception
    when raise_exception then
      if sqlerrm not like 'Opportunity and primary contact must use%' then
        raise;
      end if;
  end;

  insert into public.opportunities (
    provider_id, name, stage_id, owner_id, record_mode
  ) values (
    test_provider_id,
    'SANDBOX / DEMO lifecycle test',
    '00000000-0000-4000-8000-000000000001',
    auth.uid(),
    'sandbox'
  ) returning id into sandbox_opportunity_id;

  if not exists (
    select 1 from public.v_pipeline_board
    where id = sandbox_opportunity_id
      and stage_name = 'Identified'
      and next_action is null
      and record_mode = 'sandbox'
  ) then
    raise exception 'New sandbox opportunity did not surface as a labelled no-next-action pipeline item';
  end if;

  if not exists (
    select 1 from public.v_global_search
    where object_type = 'opportunity'
      and object_id = sandbox_opportunity_id
      and record_mode = 'sandbox'
  ) then
    raise exception 'Global search did not expose the labelled sandbox opportunity';
  end if;

  update public.opportunities
  set stage_id = '00000000-0000-4000-8000-000000000006'
  where id = sandbox_opportunity_id;

  if not exists (
    select 1 from public.v_pipeline_board
    where id = sandbox_opportunity_id and stage_name = 'Discovery'
  ) then
    raise exception 'Pipeline read model did not reflect the stage transition';
  end if;

  if not exists (
    select 1 from public.opportunity_stage_history
    where opportunity_id = sandbox_opportunity_id
      and from_stage_id = '00000000-0000-4000-8000-000000000001'
      and to_stage_id = '00000000-0000-4000-8000-000000000006'
  ) then
    raise exception 'Sandbox stage transition did not preserve history';
  end if;

  update public.opportunities
  set stage_id = '00000000-0000-4000-8000-000000000011'
  where id = sandbox_opportunity_id;

  if not exists (
    select 1 from public.customer_relationships
    where provider_id = test_provider_id
      and originating_opportunity_id = sandbox_opportunity_id
      and record_mode = 'sandbox'
  ) then
    raise exception 'Sandbox Closed-won did not create a separated sandbox customer';
  end if;

  if (select count(*) from public.customer_relationships where provider_id = test_provider_id) <> 2 then
    raise exception 'Real and sandbox customers did not coexist by provider and mode';
  end if;

  begin
    insert into public.activities (
      provider_id, opportunity_id, activity_type, subject, record_mode
    ) values (
      test_provider_id, sandbox_opportunity_id, 'call', 'Mode mismatch must fail', 'real'
    );
    raise exception 'Real activity was attached to a sandbox opportunity';
  exception
    when raise_exception then
      if sqlerrm not like 'Commercial child records must use%' then
        raise;
      end if;
  end;

  insert into public.contacts (provider_id, full_name, record_mode)
  values (test_provider_id, 'SANDBOX / DEMO contact', 'sandbox')
  returning id into sandbox_contact_id;

  insert into public.activities (
    provider_id, contact_id, activity_type, subject, record_mode
  ) values (
    test_provider_id, real_contact_id, 'call', 'Real activity mode guard', 'real'
  ) returning id into real_activity_id;

  begin
    execute 'set local role service_role';
    update public.activities set contact_id = sandbox_contact_id where id = real_activity_id;
    raise exception 'Cross-mode activity contact update was accepted';
  exception
    when raise_exception then
      if sqlerrm not like 'Activity and contact must use%' then
        raise;
      end if;
  end;

  insert into public.next_actions (
    provider_id, contact_id, title, assigned_to, record_mode
  ) values (
    test_provider_id, real_contact_id, 'Real next-action mode guard', auth.uid(), 'real'
  ) returning id into real_action_id;

  begin
    execute 'set local role service_role';
    update public.next_actions set contact_id = sandbox_contact_id where id = real_action_id;
    raise exception 'Cross-mode next-action contact update was accepted';
  exception
    when raise_exception then
      if sqlerrm not like 'Next action and contact must use%' then
        raise;
      end if;
  end;

  insert into public.next_actions (
    provider_id, opportunity_id, title, assigned_to, record_mode
  ) values (
    test_provider_id, sandbox_opportunity_id, 'SANDBOX / DEMO follow-up', auth.uid(), 'sandbox'
  );

  perform public.reset_sandbox_commercial_data();

  if exists (
    select 1 from public.opportunities opportunity
    join public.providers provider on provider.id = opportunity.provider_id
    where opportunity.record_mode = 'sandbox' and not provider.is_sample
  ) or exists (
    select 1 from public.next_actions action
    join public.providers provider on provider.id = action.provider_id
    where action.record_mode = 'sandbox' and not provider.is_sample
  ) or exists (
    select 1 from public.customer_relationships customer
    join public.providers provider on provider.id = customer.provider_id
    where customer.record_mode = 'sandbox' and not provider.is_sample
  ) then
    raise exception 'Owner sandbox reset left non-sample practice records behind';
  end if;

  if not exists (
    select 1 from public.customer_relationships
    where provider_id = test_provider_id and record_mode = 'real'
  ) then
    raise exception 'Sandbox reset removed real customer history';
  end if;
end;
$$;

rollback;

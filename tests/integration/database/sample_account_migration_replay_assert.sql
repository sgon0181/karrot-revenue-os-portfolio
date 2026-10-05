\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1 from public.opportunities
    where id = '5a777777-0000-4000-8000-000000000002'
  ) or exists (
    select 1 from public.activities
    where id = '5a777777-0000-4000-8000-000000000004'
  ) or exists (
    select 1 from public.next_actions
    where id = '5a777777-0000-4000-8000-000000000005'
  ) or exists (
    select 1 from public.customer_relationships
    where id = '5a777777-0000-4000-8000-000000000006'
  ) or exists (
    select 1 from public.customer_facilities
    where id = '5a777777-0000-4000-8000-000000000007'
  ) then
    raise exception 'Replay retained the exact W1 journey or a dependent record';
  end if;

  if not exists (
    select 1 from public.opportunities
    where id = '5a777777-0000-4000-8000-000000000003'
      and name = 'Unrelated St Basil''s sandbox opportunity'
      and record_mode = 'sandbox'
  ) or not exists (
    select 1
    from public.opportunities opportunity
    join public.providers provider on provider.id = opportunity.provider_id
    where opportunity.id = '5a777777-0000-4000-8000-000000000008'
      and opportunity.name = 'James demo — St Basil’s Randwick discovery'
      and opportunity.record_mode = 'sandbox'
      and provider.abn <> '47082585988'
      and not provider.is_sample
  ) or not exists (
    select 1 from public.contacts
    where id = '5a777777-0000-4000-8000-000000000001'
      and full_name = 'Unrelated sandbox sentinel'
      and record_mode = 'sandbox'
  ) then
    raise exception 'Replay removed unrelated sandbox data';
  end if;

  if not exists (
    select 1 from public.providers
    where abn = '47082585988'
      and business_name = 'ST BASILS HOMES'
      and not is_sample
  ) or (
    select count(*)
    from public.facilities facility
    join public.providers provider on provider.id = facility.provider_id
    where provider.abn = '47082585988'
      and not facility.is_sample
  ) <> 4 then
    raise exception 'Replay changed canonical St Basil''s provider or facilities';
  end if;

  if (select count(*) from public.providers where is_sample) <> 1
    or (select count(*) from public.facilities where is_sample) <> 1
    or (
      select count(*) from public.opportunity_stage_history
      where opportunity_id = '5a000000-0000-4000-8000-000000000005'
    ) <> 1 then
    raise exception 'Replay duplicated the sample account or its stage history';
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
    raise exception 'Replay did not preserve all sample provider source guards';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger trigger_record
    where not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
      and trigger_record.tgname = 'facility_snapshots_reject_sample_source_provider'
  ) then
    raise exception 'Replay did not preserve the facility-snapshot provider guard';
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
    raise exception 'Replay did not preserve all sample research-memory guards';
  end if;
end;
$$;

delete from public.opportunities
where id in (
  '5a777777-0000-4000-8000-000000000003',
  '5a777777-0000-4000-8000-000000000008'
);

delete from public.contacts
where id = '5a777777-0000-4000-8000-000000000001';

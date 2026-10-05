begin;

-- Sample accounts are ordinary product records, but they must never be counted
-- as government market coverage or accepted as an automated research target.
-- The marker stays in the durable model; presentation remains the UI's concern.
alter table public.providers
  add column if not exists is_sample boolean not null default false;

alter table public.providers
  drop constraint if exists providers_sample_source_boundary;
alter table public.providers
  add constraint providers_sample_source_boundary check (
    not is_sample or current_authoritative_source_record_id is null
  );

alter table public.facilities
  alter column current_authoritative_source_record_id drop not null,
  add column if not exists is_sample boolean not null default false,
  add column if not exists location_label text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

alter table public.facilities
  drop constraint if exists facilities_sample_authoritative_source_boundary;
alter table public.facilities
  add constraint facilities_sample_authoritative_source_boundary check (
    (is_sample and current_authoritative_source_record_id is null)
    or (not is_sample and current_authoritative_source_record_id is not null)
  );

alter table public.facilities
  drop constraint if exists facilities_direct_coordinates_pair;
alter table public.facilities
  add constraint facilities_direct_coordinates_pair check (
    (latitude is null and longitude is null)
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
    )
  );

alter table public.facilities
  drop constraint if exists facilities_sample_location_boundary;
alter table public.facilities
  add constraint facilities_sample_location_boundary check (
    (
      is_sample
      and length(trim(coalesce(location_label, ''))) > 0
      and latitude is not null
      and longitude is not null
    )
    or (
      not is_sample
      and location_label is null
      and latitude is null
      and longitude is null
    )
  );

create or replace function private.validate_facility_sample_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_is_sample boolean;
begin
  select provider.is_sample into provider_is_sample
  from public.providers provider
  where provider.id = new.provider_id;

  if provider_is_sample is null then
    raise exception 'Facility provider does not exist';
  end if;
  if new.is_sample is distinct from provider_is_sample then
    raise exception 'Facility sample scope must match its provider';
  end if;
  return new;
end;
$$;

drop trigger if exists facilities_validate_sample_scope on public.facilities;
create trigger facilities_validate_sample_scope
before insert or update of provider_id, is_sample on public.facilities
for each row execute function private.validate_facility_sample_scope();

create or replace function private.prevent_sample_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_sample is distinct from old.is_sample then
    raise exception 'Sample scope cannot change after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists providers_prevent_sample_scope_change on public.providers;
create trigger providers_prevent_sample_scope_change
before update of is_sample on public.providers
for each row execute function private.prevent_sample_scope_change();

drop trigger if exists facilities_prevent_sample_scope_change on public.facilities;
create trigger facilities_prevent_sample_scope_change
before update of is_sample on public.facilities
for each row execute function private.prevent_sample_scope_change();

-- Government-source observations and deterministic match state must never be
-- attached to the fictional account, including through manual match review or
-- a service-role write that bypasses the ingestion match index.
create or replace function private.reject_sample_facility_source_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.facility_id is not null and exists (
    select 1
    from public.facilities facility
    where facility.id = new.facility_id
      and facility.is_sample
  ) then
    raise exception 'Authoritative source data cannot target sample facilities';
  end if;
  return new;
end;
$$;

drop trigger if exists facility_snapshots_reject_sample_source
on public.facility_snapshots;
create trigger facility_snapshots_reject_sample_source
before insert or update of facility_id on public.facility_snapshots
for each row execute function private.reject_sample_facility_source_link();

drop trigger if exists facility_aliases_reject_sample_source
on public.facility_aliases;
create trigger facility_aliases_reject_sample_source
before insert or update of facility_id on public.facility_aliases
for each row execute function private.reject_sample_facility_source_link();

drop trigger if exists facility_match_decisions_reject_sample_source
on public.facility_match_decisions;
create trigger facility_match_decisions_reject_sample_source
before insert or update of facility_id on public.facility_match_decisions
for each row execute function private.reject_sample_facility_source_link();

drop trigger if exists facility_match_candidates_reject_sample_source
on public.facility_match_candidates;
create trigger facility_match_candidates_reject_sample_source
before insert or update of facility_id on public.facility_match_candidates
for each row execute function private.reject_sample_facility_source_link();

drop trigger if exists facility_match_review_events_reject_sample_source
on public.facility_match_review_events;
create trigger facility_match_review_events_reject_sample_source
before insert or update of facility_id on public.facility_match_review_events
for each row execute function private.reject_sample_facility_source_link();

drop trigger if exists star_rating_snapshots_reject_sample_source
on public.star_rating_snapshots;
create trigger star_rating_snapshots_reject_sample_source
before insert or update of facility_id on public.star_rating_snapshots
for each row execute function private.reject_sample_facility_source_link();

drop trigger if exists care_minutes_snapshots_reject_sample_source
on public.care_minutes_snapshots;
create trigger care_minutes_snapshots_reject_sample_source
before insert or update of facility_id on public.care_minutes_snapshots
for each row execute function private.reject_sample_facility_source_link();

create or replace function private.reject_sample_provider_source_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.providers provider
    where provider.id = new.provider_id
      and provider.is_sample
  ) then
    raise exception 'Authoritative source data cannot target sample providers';
  end if;
  return new;
end;
$$;

-- Facility snapshots carry both sides of the provider/facility relationship.
-- Guard each foreign key so a normal facility cannot be attributed to the
-- fictional provider through a mismatched service-role write.
drop trigger if exists facility_snapshots_reject_sample_source_provider
on public.facility_snapshots;
create trigger facility_snapshots_reject_sample_source_provider
before insert or update of provider_id on public.facility_snapshots
for each row execute function private.reject_sample_provider_source_link();

drop trigger if exists provider_snapshots_reject_sample_source
on public.provider_snapshots;
create trigger provider_snapshots_reject_sample_source
before insert or update of provider_id on public.provider_snapshots
for each row execute function private.reject_sample_provider_source_link();

drop trigger if exists provider_aliases_reject_sample_source
on public.provider_aliases;
create trigger provider_aliases_reject_sample_source
before insert or update of provider_id on public.provider_aliases
for each row execute function private.reject_sample_provider_source_link();

drop trigger if exists provider_service_types_reject_sample_source
on public.provider_service_types;
create trigger provider_service_types_reject_sample_source
before insert or update of provider_id on public.provider_service_types
for each row execute function private.reject_sample_provider_source_link();

drop trigger if exists provider_lgas_reject_sample_source
on public.provider_lgas;
create trigger provider_lgas_reject_sample_source
before insert or update of provider_id on public.provider_lgas
for each row execute function private.reject_sample_provider_source_link();

drop trigger if exists provider_regulatory_notices_reject_sample_source
on public.provider_regulatory_notices;
create trigger provider_regulatory_notices_reject_sample_source
before insert or update of provider_id on public.provider_regulatory_notices
for each row execute function private.reject_sample_provider_source_link();

-- Commercial records created against a sample provider are always practice
-- records, even when a direct client mistakenly supplies record_mode = real.
create or replace function private.enforce_sample_commercial_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.providers provider
    where provider.id = new.provider_id and provider.is_sample
  ) then
    new.record_mode = 'sandbox';
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_enforce_sample_commercial_mode on public.contacts;
create trigger contacts_enforce_sample_commercial_mode
before insert or update of provider_id, record_mode on public.contacts
for each row execute function private.enforce_sample_commercial_mode();

drop trigger if exists opportunities_enforce_sample_commercial_mode on public.opportunities;
create trigger opportunities_enforce_sample_commercial_mode
before insert or update of provider_id, record_mode on public.opportunities
for each row execute function private.enforce_sample_commercial_mode();

drop trigger if exists activities_enforce_sample_commercial_mode on public.activities;
create trigger activities_enforce_sample_commercial_mode
before insert or update of provider_id, record_mode on public.activities
for each row execute function private.enforce_sample_commercial_mode();

drop trigger if exists next_actions_enforce_sample_commercial_mode on public.next_actions;
create trigger next_actions_enforce_sample_commercial_mode
before insert or update of provider_id, record_mode on public.next_actions
for each row execute function private.enforce_sample_commercial_mode();

drop trigger if exists customer_relationships_enforce_sample_commercial_mode
on public.customer_relationships;
create trigger customer_relationships_enforce_sample_commercial_mode
before insert or update of provider_id, record_mode on public.customer_relationships
for each row execute function private.enforce_sample_commercial_mode();

-- Planner visits gain a real title and the same hidden practice-data boundary.
alter table public.field_visits
  add column if not exists title text,
  add column if not exists record_mode text not null default 'real'
    check (record_mode in ('real', 'sandbox'));

update public.field_visits visit
set title = facility.name || ' visit'
from public.facilities facility
where facility.id = visit.facility_id
  and nullif(trim(visit.title), '') is null;

alter table public.field_visits
  alter column title set not null,
  alter column title set default '';

alter table public.field_visits
  drop constraint if exists field_visits_title_present;
alter table public.field_visits
  add constraint field_visits_title_present check (length(trim(title)) > 0);

create or replace function private.prepare_field_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  facility_name text;
  provider_is_sample boolean;
  expected_record_mode text;
begin
  select facility.name, provider.is_sample
  into facility_name, provider_is_sample
  from public.facilities facility
  join public.providers provider on provider.id = facility.provider_id
  where facility.id = new.facility_id;

  if facility_name is null then
    raise exception 'Visit facility does not exist';
  end if;
  if nullif(trim(new.title), '') is null then
    new.title = facility_name || ' visit';
  end if;
  expected_record_mode := case
    when provider_is_sample then 'sandbox'
    else 'real'
  end;
  if tg_op = 'INSERT' then
    new.record_mode := expected_record_mode;
  elsif expected_record_mode is distinct from old.record_mode then
    raise exception 'Visit facility cannot cross the sample account boundary';
  else
    new.record_mode := old.record_mode;
  end if;
  return new;
end;
$$;

drop trigger if exists field_visits_prepare_record on public.field_visits;
create trigger field_visits_prepare_record
before insert or update on public.field_visits
for each row execute function private.prepare_field_visit();

drop trigger if exists field_visits_prevent_record_mode_change on public.field_visits;
create trigger field_visits_prevent_record_mode_change
before update of record_mode on public.field_visits
for each row execute function private.prevent_commercial_record_mode_change();

create index if not exists field_visits_record_mode_idx
on public.field_visits (record_mode, starts_at);

create or replace function private.validate_field_visit_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  facility_provider_id uuid;
  contact_provider_id uuid;
  contact_facility_id uuid;
  contact_record_mode text;
begin
  if new.contact_id is null then
    return new;
  end if;

  select facility.provider_id into facility_provider_id
  from public.facilities facility
  where facility.id = new.facility_id;

  select contact.provider_id, contact.facility_id, contact.record_mode
  into contact_provider_id, contact_facility_id, contact_record_mode
  from public.contacts contact
  where contact.id = new.contact_id;

  if contact_provider_id is null
    or contact_provider_id <> facility_provider_id
    or (contact_facility_id is not null and contact_facility_id <> new.facility_id) then
    raise exception 'Visit contact must belong to the selected facility or its provider';
  end if;
  if contact_record_mode <> new.record_mode then
    raise exception 'Visit and contact must use the same record mode';
  end if;

  return new;
end;
$$;

grant insert (title, record_mode) on public.field_visits to authenticated;
grant update (title) on public.field_visits to authenticated;

-- Fail closed if any application or service-role path tries to create research
-- memory for a sample provider or facility.
create or replace function private.reject_sample_research()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.providers provider
    where provider.id = new.provider_id and provider.is_sample
  ) or (
    new.facility_id is not null
    and exists (
      select 1 from public.facilities facility
      where facility.id = new.facility_id and facility.is_sample
    )
  ) then
    raise exception 'Research is unavailable for sample accounts';
  end if;
  return new;
end;
$$;

drop trigger if exists account_research_jobs_reject_sample
on public.account_research_jobs;
create trigger account_research_jobs_reject_sample
before insert or update of provider_id, facility_id on public.account_research_jobs
for each row execute function private.reject_sample_research();

create or replace function private.reject_sample_research_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.providers provider
    where provider.id = new.provider_id
      and provider.is_sample
  ) then
    raise exception 'Research is unavailable for sample accounts';
  end if;
  return new;
end;
$$;

drop trigger if exists intelligence_sources_reject_sample
on public.intelligence_sources;
create trigger intelligence_sources_reject_sample
before insert or update of provider_id on public.intelligence_sources
for each row execute function private.reject_sample_research_provider();

drop trigger if exists intelligence_claims_reject_sample
on public.intelligence_claims;
create trigger intelligence_claims_reject_sample
before insert or update of provider_id on public.intelligence_claims
for each row execute function private.reject_sample_research_provider();

drop trigger if exists commercial_account_facts_reject_sample
on public.commercial_account_facts;
create trigger commercial_account_facts_reject_sample
before insert or update of provider_id, facility_id on public.commercial_account_facts
for each row execute function private.reject_sample_research();

drop trigger if exists intelligence_review_events_reject_sample
on public.intelligence_review_events;
create trigger intelligence_review_events_reject_sample
before insert or update of provider_id on public.intelligence_review_events
for each row execute function private.reject_sample_research_provider();

create or replace function public.start_scoped_account_research(
  p_provider_id uuid,
  p_model text,
  p_facility_id uuid default null,
  p_request_context jsonb default '{}'::jsonb,
  p_provider_snapshot jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id uuid;
  target_label text;
begin
  if auth.uid() is null or not private.can_edit() then
    raise exception using errcode = '42501', message = 'Editor access is required';
  end if;
  if not exists (
    select 1 from public.providers
    where id = p_provider_id and archived_at is null
  ) then
    raise exception 'Provider not found';
  end if;
  if exists (
    select 1 from public.providers
    where id = p_provider_id and is_sample
  ) then
    raise exception 'Research is unavailable for sample accounts';
  end if;
  if p_facility_id is not null and not exists (
    select 1 from public.facilities
    where id = p_facility_id
      and provider_id = p_provider_id
      and archived_at is null
  ) then
    raise exception 'Facility not found for this provider';
  end if;
  if p_facility_id is not null and exists (
    select 1 from public.facilities
    where id = p_facility_id and is_sample
  ) then
    raise exception 'Research is unavailable for sample accounts';
  end if;

  update public.account_research_jobs
  set status = 'failed', completed_at = now(),
      error_code = 'research_abandoned',
      error_message = 'Research did not complete. Previous intelligence was preserved; retry is safe.'
  where provider_id = p_provider_id
    and facility_id is not distinct from p_facility_id
    and status in ('queued', 'running')
    and coalesce(started_at, requested_at) < now() - interval '5 minutes';

  begin
    insert into public.account_research_jobs (
      provider_id, facility_id, research_scope, status, model,
      request_context, provider_snapshot, started_at, created_by
    ) values (
      p_provider_id, p_facility_id,
      case when p_facility_id is null then 'provider' else 'facility' end,
      'running', p_model, coalesce(p_request_context, '{}'::jsonb),
      coalesce(p_provider_snapshot, '{}'::jsonb), now(), auth.uid()
    ) returning id into job_id;
  exception
    when unique_violation then
      target_label := case when p_facility_id is null then 'provider' else 'facility' end;
      raise exception using
        errcode = 'P0001',
        message = format('Research is already running for this %s.', target_label);
  end;

  return job_id;
end;
$$;

create or replace function public.research_coverage_snapshot(
  p_fresh_days integer default 14,
  p_as_of timestamptz default now()
)
returns table (
  provider_completed bigint,
  facility_completed bigint,
  fresh bigint,
  needs_refresh bigint,
  researching bigint
)
language sql
stable
set search_path = ''
as $$
  with automated as (
    select job.*
    from public.account_research_jobs job
    join public.providers provider on provider.id = job.provider_id
    where job.model <> 'operator-curated'
      and provider.archived_at is null
      and not provider.is_sample
      and (
        job.facility_id is null
        or exists (
          select 1 from public.facilities facility
          where facility.id = job.facility_id
            and facility.archived_at is null
            and not facility.is_sample
        )
      )
  ),
  latest_attempt as (
    select distinct on (job.provider_id, job.facility_id)
      job.provider_id, job.facility_id, job.status,
      job.requested_at, job.completed_at
    from automated job
    order by job.provider_id, job.facility_id, job.requested_at desc, job.id desc
  ),
  latest_completed as (
    select distinct on (job.provider_id, job.facility_id)
      job.provider_id, job.facility_id, job.requested_at, job.completed_at
    from automated job
    where job.status = 'completed'
    order by job.provider_id, job.facility_id, job.requested_at desc, job.id desc
  ),
  lifecycle as (
    select attempt.provider_id, attempt.facility_id, attempt.status,
           completed.completed_at, completed.requested_at as completed_requested_at
    from latest_attempt attempt
    left join latest_completed completed
      on completed.provider_id = attempt.provider_id
     and completed.facility_id is not distinct from attempt.facility_id
  )
  select
    count(*) filter (where facility_id is null and completed_at is not null),
    count(*) filter (where facility_id is not null and completed_at is not null),
    count(*) filter (
      where completed_at is not null
        and status = 'completed'
        and p_as_of - coalesce(completed_at, completed_requested_at)
          <= make_interval(days => greatest(p_fresh_days, 1))
    ),
    count(*) filter (
      where completed_at is not null
        and (
          status = 'failed'
          or (
            status = 'completed'
            and p_as_of - coalesce(completed_at, completed_requested_at)
              > make_interval(days => greatest(p_fresh_days, 1))
          )
        )
    ),
    count(*) filter (where status in ('queued', 'running'))
  from lifecycle;
$$;

-- Directory summaries use real commercial rows for authoritative providers and
-- sandbox rows for the sample provider. The sample therefore behaves like a
-- normal account without leaking into real operating metrics.
create or replace view public.v_provider_overview
with (security_invoker = true)
as
with facility_summary as (
  select
    facility.provider_id,
    count(*)::bigint as facility_count,
    string_agg(
      lower(concat_ws(
        ' ', facility.name, facility.street, facility.suburb,
        facility.postcode, facility.full_address,
        case when facility.is_sample then null else facility.acqsc_site_id end,
        facility.location_label
      )),
      ' '
    ) as facility_search_text
  from public.facilities facility
  where facility.archived_at is null
  group by facility.provider_id
), contact_summary as (
  select contact.provider_id, count(*)::bigint as contact_count
  from public.contacts contact
  join public.providers provider on provider.id = contact.provider_id
  where contact.record_mode = case when provider.is_sample then 'sandbox' else 'real' end
  group by contact.provider_id
), opportunity_summary as (
  select opportunity.provider_id, count(*)::bigint as open_opportunity_count
  from public.opportunities opportunity
  join public.providers provider on provider.id = opportunity.provider_id
  join public.pipeline_stages stage on stage.id = opportunity.stage_id
  where opportunity.record_mode = case when provider.is_sample then 'sandbox' else 'real' end
    and stage.outcome is null
  group by opportunity.provider_id
), current_activity as (
  select distinct on (opportunity.provider_id)
    opportunity.provider_id,
    stage.name as stage_name,
    opportunity.record_mode
  from public.opportunities opportunity
  join public.providers provider on provider.id = opportunity.provider_id
  join public.pipeline_stages stage on stage.id = opportunity.stage_id
  where opportunity.record_mode = case when provider.is_sample then 'sandbox' else 'real' end
  order by opportunity.provider_id, opportunity.updated_at desc, opportunity.id
), current_customer as (
  select distinct on (customer.provider_id)
    customer.provider_id,
    customer.status,
    customer.record_mode
  from public.customer_relationships customer
  join public.providers provider on provider.id = customer.provider_id
  where customer.record_mode = case when provider.is_sample then 'sandbox' else 'real' end
  order by customer.provider_id, customer.updated_at desc, customer.id
), latest_activity as (
  select activity.provider_id, max(activity.occurred_at) as occurred_at
  from public.activities activity
  join public.providers provider on provider.id = activity.provider_id
  where activity.record_mode = case when provider.is_sample then 'sandbox' else 'real' end
  group by activity.provider_id
), next_action as (
  select distinct on (action.provider_id)
    action.provider_id,
    action.title,
    action.due_at
  from public.next_actions action
  join public.providers provider on provider.id = action.provider_id
  where action.status = 'open'
    and action.record_mode = case when provider.is_sample then 'sandbox' else 'real' end
  order by action.provider_id, action.due_at asc nulls last, action.created_at asc, action.id
)
select
  provider.id,
  provider.abn,
  provider.entity_name,
  provider.business_name,
  provider.registration_status,
  provider.first_seen_at,
  provider.last_seen_at,
  coalesce(facility.facility_count, 0)::bigint as facility_count,
  coalesce(contact.contact_count, 0)::bigint as contact_count,
  coalesce(opportunity.open_opportunity_count, 0)::bigint as open_opportunity_count,
  activity.stage_name as current_commercial_activity,
  customer.status as customer_status,
  latest.occurred_at as last_activity_at,
  action.title as next_action,
  action.due_at as next_action_due_at,
  activity.record_mode as current_record_mode,
  customer.record_mode as customer_record_mode,
  lower(concat_ws(
    ' ', provider.business_name, provider.entity_name,
    case when provider.is_sample then null else provider.abn end,
    coalesce(facility.facility_search_text, '')
  )) as search_text,
  provider.is_sample
from public.providers provider
left join facility_summary facility on facility.provider_id = provider.id
left join contact_summary contact on contact.provider_id = provider.id
left join opportunity_summary opportunity on opportunity.provider_id = provider.id
left join current_activity activity on activity.provider_id = provider.id
left join current_customer customer on customer.provider_id = provider.id
left join latest_activity latest on latest.provider_id = provider.id
left join next_action action on action.provider_id = provider.id
where provider.archived_at is null;

-- Global search also exposes only identifiers that are visible in the product.
-- Synthetic ABN/Site keys remain internal implementation details for the
-- directly entered sample account.
create or replace view public.v_global_search
with (security_invoker = true)
as
select
  'provider'::text as object_type,
  provider.id as object_id,
  provider.id as provider_id,
  provider.business_name as title,
  case
    when provider.is_sample then 'CRM account'
    else concat_ws(' · ', provider.entity_name, 'ABN ' || provider.abn)
  end as subtitle,
  null::text as location,
  null::text as record_mode,
  lower(concat_ws(
    ' ', provider.business_name, provider.entity_name,
    case when provider.is_sample then null else provider.abn end
  )) as search_text
from public.providers provider
where provider.archived_at is null
union all
select
  'facility',
  facility.id,
  facility.provider_id,
  facility.name,
  case
    when facility.is_sample then concat_ws(' · ', provider.business_name, facility.location_label)
    else concat_ws(' · ', provider.business_name, 'Site ' || facility.acqsc_site_id)
  end,
  facility.full_address,
  null,
  lower(concat_ws(
    ' ', facility.name, facility.street, facility.suburb, facility.postcode,
    facility.full_address,
    case when facility.is_sample then null else facility.acqsc_site_id end,
    facility.location_label, provider.business_name, provider.entity_name,
    case when provider.is_sample then null else provider.abn end
  ))
from public.facilities facility
join public.providers provider on provider.id = facility.provider_id
where facility.archived_at is null and provider.archived_at is null
union all
select
  'contact',
  contact.id,
  contact.provider_id,
  contact.full_name,
  concat_ws(' · ', contact.title, provider.business_name),
  null,
  contact.record_mode,
  lower(concat_ws(
    ' ', contact.full_name, contact.title, contact.role_category, contact.email,
    provider.business_name, provider.entity_name,
    case when provider.is_sample then null else provider.abn end
  ))
from public.contacts contact
join public.providers provider on provider.id = contact.provider_id
union all
select
  'opportunity',
  opportunity.id,
  opportunity.provider_id,
  opportunity.name,
  concat_ws(' · ', provider.business_name, stage.name),
  null,
  opportunity.record_mode,
  lower(concat_ws(
    ' ', opportunity.name, provider.business_name, provider.entity_name,
    case when provider.is_sample then null else provider.abn end,
    stage.name
  ))
from public.opportunities opportunity
join public.providers provider on provider.id = opportunity.provider_id
join public.pipeline_stages stage on stage.id = opportunity.stage_id
union all
select
  'customer',
  customer.id,
  customer.provider_id,
  provider.business_name,
  concat_ws(' · ', 'Customer', customer.status, customer.onboarding_state),
  null,
  customer.record_mode,
  lower(concat_ws(
    ' ', provider.business_name, provider.entity_name,
    case when provider.is_sample then null else provider.abn end,
    customer.status, customer.onboarding_state
  ))
from public.customer_relationships customer
join public.providers provider on provider.id = customer.provider_id;

create or replace view public.v_facility_latest
with (security_invoker = true)
as
select
  facility.id,
  facility.acqsc_site_id,
  facility.provider_id,
  provider.business_name as provider_name,
  facility.name,
  facility.street,
  facility.suburb,
  facility.state,
  facility.postcode,
  facility.full_address,
  star.reporting_month as star_reporting_month,
  star.observed_provider_name as star_observed_provider_name,
  star.source_file_name as star_source_file_name,
  star.source_sheet_name as star_source_sheet_name,
  star.source_row_number as star_source_row_number,
  star.source_sha256 as star_source_sha256,
  star.source_url as star_source_url,
  star.overall_rating,
  star.residents_experience_rating,
  star.compliance_rating,
  star.staffing_rating,
  star.quality_measures_rating,
  care.period_end as care_minutes_period_end,
  care.observed_provider_name as care_observed_provider_name,
  care.source_file_name as care_source_file_name,
  care.source_sheet_name as care_source_sheet_name,
  care.source_row_number as care_source_row_number,
  care.source_sha256 as care_source_sha256,
  care.source_url as care_source_url,
  care.home_size_band as approved_bed_size_band,
  care.total_minutes_target,
  care.total_minutes_actual,
  care.total_target_percentage,
  care.rn_minutes_target,
  care.rn_minutes_actual,
  care.rn_target_percentage,
  care.met_responsibility,
  coalesce(care.longitude, facility.longitude) as longitude,
  coalesce(care.latitude, facility.latitude) as latitude,
  facility.location_label,
  facility.is_sample
from public.facilities facility
join public.providers provider on provider.id = facility.provider_id
left join lateral (
  select
    snapshot.*,
    source_record.sheet_name as source_sheet_name,
    source_record.row_number as source_row_number,
    source_file.file_name as source_file_name,
    source_file.sha256 as source_sha256,
    source_file.source_url
  from public.star_rating_snapshots snapshot
  join public.source_records source_record on source_record.id = snapshot.source_record_id
  join public.source_files source_file on source_file.id = snapshot.source_file_id
  where snapshot.facility_id = facility.id
  order by snapshot.reporting_month desc, snapshot.id desc
  limit 1
) star on true
left join lateral (
  select
    snapshot.*,
    source_record.sheet_name as source_sheet_name,
    source_record.row_number as source_row_number,
    source_file.file_name as source_file_name,
    source_file.sha256 as source_sha256,
    source_file.source_url
  from public.care_minutes_snapshots snapshot
  join public.source_records source_record on source_record.id = snapshot.source_record_id
  join public.source_files source_file on source_file.id = snapshot.source_file_id
  where snapshot.facility_id = facility.id
  order by snapshot.period_end desc, snapshot.id desc
  limit 1
) care on true
where facility.archived_at is null;

create or replace view public.v_dashboard_metrics
with (security_invoker = true)
as
select
  (
    select count(*) from public.providers
    where archived_at is null and not is_sample
  )::bigint as nsw_providers,
  (
    select count(*) from public.facilities
    where archived_at is null and state = 'NSW' and not is_sample
  )::bigint as nsw_facilities,
  (select count(*) from public.contacts where record_mode = 'real')::bigint as contacts,
  (
    select count(*)
    from public.opportunities opportunity
    join public.pipeline_stages stage on stage.id = opportunity.stage_id
    where stage.outcome is null and opportunity.record_mode = 'real'
  )::bigint as active_opportunities,
  (
    select count(*) from public.next_actions
    where status = 'open' and due_at is not null and record_mode = 'real'
  )::bigint as actions_due,
  (
    select count(*) from public.next_actions
    where status = 'open' and due_at < now() and record_mode = 'real'
  )::bigint as overdue_actions,
  (
    select count(*) from public.customer_relationships
    where status = 'active' and record_mode = 'real'
  )::bigint as active_customers,
  (
    select count(*)
    from public.customer_facilities customer_facility
    join public.customer_relationships customer
      on customer.id = customer_facility.customer_relationship_id
    where customer_facility.status = 'live' and customer.record_mode = 'real'
  )::bigint as facilities_live,
  coalesce((
    select sum(customer_facility.live_beds)
    from public.customer_facilities customer_facility
    join public.customer_relationships customer
      on customer.id = customer_facility.customer_relationship_id
    where customer_facility.status = 'live' and customer.record_mode = 'real'
  ), 0)::bigint as beds_live,
  (
    select sum(mrr) from public.customer_relationships
    where status = 'active' and record_mode = 'real'
  )::numeric as mrr,
  (
    select sum(arr) from public.customer_relationships
    where status = 'active' and record_mode = 'real'
  )::numeric as arr,
  (
    select count(*)
    from public.opportunities opportunity
    join public.pipeline_stages stage on stage.id = opportunity.stage_id
    where stage.outcome is null and opportunity.record_mode = 'sandbox'
  )::bigint as sandbox_opportunities,
  (
    select count(*) from public.next_actions
    where status = 'open' and record_mode = 'sandbox'
  )::bigint as sandbox_open_actions,
  (
    select count(*) from public.customer_relationships
    where record_mode = 'sandbox'
  )::bigint as sandbox_customers;

create or replace function public.reset_sandbox_commercial_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit_count integer;
  action_count integer;
  activity_count integer;
  customer_count integer;
  opportunity_count integer;
  contact_count integer;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.role = 'owner'
  ) then
    raise exception 'Owner access required';
  end if;

  delete from public.field_visits visit
  using public.facilities facility, public.providers provider
  where visit.facility_id = facility.id
    and facility.provider_id = provider.id
    and visit.record_mode = 'sandbox'
    and not provider.is_sample;
  get diagnostics visit_count = row_count;
  delete from public.next_actions action
  using public.providers provider
  where action.provider_id = provider.id
    and action.record_mode = 'sandbox'
    and not provider.is_sample;
  get diagnostics action_count = row_count;
  delete from public.activities activity
  using public.providers provider
  where activity.provider_id = provider.id
    and activity.record_mode = 'sandbox'
    and not provider.is_sample;
  get diagnostics activity_count = row_count;
  delete from public.customer_relationships customer
  using public.providers provider
  where customer.provider_id = provider.id
    and customer.record_mode = 'sandbox'
    and not provider.is_sample;
  get diagnostics customer_count = row_count;
  delete from public.opportunities opportunity
  using public.providers provider
  where opportunity.provider_id = provider.id
    and opportunity.record_mode = 'sandbox'
    and not provider.is_sample;
  get diagnostics opportunity_count = row_count;
  delete from public.contacts contact
  using public.providers provider
  where contact.provider_id = provider.id
    and contact.record_mode = 'sandbox'
    and not provider.is_sample;
  get diagnostics contact_count = row_count;

  return jsonb_build_object(
    'field_visits', visit_count,
    'next_actions', action_count,
    'activities', activity_count,
    'customers', customer_count,
    'opportunities', opportunity_count,
    'contacts', contact_count
  );
end;
$$;

-- Remove only the exact W1 practice journey. Canonical St Basil's provider,
-- facility, intelligence and evidence rows are not touched.
delete from public.next_actions action
where action.opportunity_id in (
  select opportunity.id
  from public.opportunities opportunity
  join public.providers provider on provider.id = opportunity.provider_id
  where opportunity.name = 'James demo — St Basil’s Randwick discovery'
    and opportunity.record_mode = 'sandbox'
    and provider.abn = '47082585988'
);

delete from public.activities activity
where activity.opportunity_id in (
  select opportunity.id
  from public.opportunities opportunity
  join public.providers provider on provider.id = opportunity.provider_id
  where opportunity.name = 'James demo — St Basil’s Randwick discovery'
    and opportunity.record_mode = 'sandbox'
    and provider.abn = '47082585988'
);

delete from public.customer_relationships customer
where customer.originating_opportunity_id in (
  select opportunity.id
  from public.opportunities opportunity
  join public.providers provider on provider.id = opportunity.provider_id
  where opportunity.name = 'James demo — St Basil’s Randwick discovery'
    and opportunity.record_mode = 'sandbox'
    and provider.abn = '47082585988'
);

delete from public.opportunities opportunity
using public.providers provider
where provider.id = opportunity.provider_id
  and provider.abn = '47082585988'
  and opportunity.name = 'James demo — St Basil’s Randwick discovery'
  and opportunity.record_mode = 'sandbox';

-- Deterministic identifiers make the fixture safe to replay and easy to verify.
insert into public.providers (
  id, abn, entity_name, business_name,
  normalized_entity_name, normalized_business_name,
  registration_status, current_authoritative_source_record_id,
  first_seen_at, last_seen_at, is_sample
) values (
  '5a000000-0000-4000-8000-000000000001',
  '00000000000',
  'Sample Oscorp Retirement Home',
  'Sample Oscorp Retirement Home',
  'sample oscorp retirement home',
  'sample oscorp retirement home',
  'Registered',
  null,
  '2026-08-26 00:00:00+10',
  '2026-08-26 00:00:00+10',
  true
)
on conflict (id) do update set
  abn = excluded.abn,
  entity_name = excluded.entity_name,
  business_name = excluded.business_name,
  normalized_entity_name = excluded.normalized_entity_name,
  normalized_business_name = excluded.normalized_business_name,
  registration_status = excluded.registration_status,
  current_authoritative_source_record_id = null,
  first_seen_at = excluded.first_seen_at,
  last_seen_at = excluded.last_seen_at,
  archived_at = null,
  is_sample = true;

insert into public.facilities (
  id, acqsc_site_id, provider_id, name, normalized_name,
  street, suburb, normalized_suburb, state, postcode,
  full_address, normalized_address,
  current_authoritative_source_record_id,
  first_seen_at, last_seen_at,
  is_sample, location_label, latitude, longitude
) values (
  '5a000000-0000-4000-8000-000000000002',
  'SAMPLE-OSCORP-001',
  '5a000000-0000-4000-8000-000000000001',
  'Sample Queens Uncle Ben House',
  'sample queens uncle ben house',
  'Bennelong Point',
  'Sydney',
  'sydney',
  'NSW',
  '2000',
  'Bennelong Point, Sydney NSW 2000',
  'bennelong point sydney nsw 2000',
  null,
  '2026-08-26 00:00:00+10',
  '2026-08-26 00:00:00+10',
  true,
  'Sydney Opera House Attic',
  -33.8566674153,
  151.2152213360
)
on conflict (id) do update set
  acqsc_site_id = excluded.acqsc_site_id,
  provider_id = excluded.provider_id,
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  street = excluded.street,
  suburb = excluded.suburb,
  normalized_suburb = excluded.normalized_suburb,
  state = excluded.state,
  postcode = excluded.postcode,
  full_address = excluded.full_address,
  normalized_address = excluded.normalized_address,
  current_authoritative_source_record_id = null,
  first_seen_at = excluded.first_seen_at,
  last_seen_at = excluded.last_seen_at,
  archived_at = null,
  is_sample = true,
  location_label = excluded.location_label,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

insert into public.contacts (
  id, provider_id, facility_id, full_name, title,
  relationship_status, currentness_status, notes, record_mode
) values
  (
    '5a000000-0000-4000-8000-000000000003',
    '5a000000-0000-4000-8000-000000000001',
    '5a000000-0000-4000-8000-000000000002',
    'Norman Osborn',
    'Executive Director',
    'new',
    'unverified',
    null,
    'sandbox'
  ),
  (
    '5a000000-0000-4000-8000-000000000004',
    '5a000000-0000-4000-8000-000000000001',
    '5a000000-0000-4000-8000-000000000002',
    'Peter Parker',
    'Head of Friendly Neighborhood',
    'new',
    'unverified',
    null,
    'sandbox'
  )
on conflict (id) do update set
  provider_id = excluded.provider_id,
  facility_id = excluded.facility_id,
  full_name = excluded.full_name,
  title = excluded.title,
  relationship_status = excluded.relationship_status,
  currentness_status = excluded.currentness_status,
  notes = excluded.notes;

insert into public.opportunities (
  id, provider_id, name, stage_id, primary_contact_id,
  notes, problem_statement, why_now, record_mode
) values (
  '5a000000-0000-4000-8000-000000000005',
  '5a000000-0000-4000-8000-000000000001',
  'Spidey Opera Care — precision-care pilot',
  '00000000-0000-4000-8000-000000000006',
  '5a000000-0000-4000-8000-000000000004',
  null,
  'Explore a precision-care pilot for Queens Uncle Ben House.',
  'Initial discovery is ready to schedule.',
  'sandbox'
)
on conflict (id) do update set
  provider_id = excluded.provider_id,
  name = excluded.name,
  stage_id = excluded.stage_id,
  primary_contact_id = excluded.primary_contact_id,
  notes = excluded.notes,
  problem_statement = excluded.problem_statement,
  why_now = excluded.why_now;

insert into public.activities (
  id, provider_id, facility_id, opportunity_id, contact_id,
  activity_type, subject, notes, occurred_at, record_mode
) values (
  '5a000000-0000-4000-8000-000000000006',
  '5a000000-0000-4000-8000-000000000001',
  '5a000000-0000-4000-8000-000000000002',
  '5a000000-0000-4000-8000-000000000005',
  '5a000000-0000-4000-8000-000000000004',
  'call',
  'Introductory call — precision-care requirements',
  null,
  '2026-08-25 10:00:00+10',
  'sandbox'
)
on conflict (id) do update set
  provider_id = excluded.provider_id,
  facility_id = excluded.facility_id,
  opportunity_id = excluded.opportunity_id,
  contact_id = excluded.contact_id,
  activity_type = excluded.activity_type,
  subject = excluded.subject,
  notes = excluded.notes,
  occurred_at = excluded.occurred_at;

insert into public.next_actions (
  id, provider_id, opportunity_id, contact_id,
  title, due_at, status, priority, notes, record_mode
) values (
  '5a000000-0000-4000-8000-000000000007',
  '5a000000-0000-4000-8000-000000000001',
  '5a000000-0000-4000-8000-000000000005',
  '5a000000-0000-4000-8000-000000000004',
  'Confirm discovery meeting with Peter Parker',
  '2026-08-27 17:00:00+10',
  'open',
  'normal',
  null,
  'sandbox'
)
on conflict (id) do update set
  provider_id = excluded.provider_id,
  opportunity_id = excluded.opportunity_id,
  contact_id = excluded.contact_id,
  title = excluded.title,
  due_at = excluded.due_at,
  status = excluded.status,
  priority = excluded.priority,
  completed_at = null,
  notes = excluded.notes;

insert into public.field_visits (
  id, facility_id, contact_id, title,
  starts_at, ends_at, status, notes, record_mode
) values (
  '5a000000-0000-4000-8000-000000000008',
  '5a000000-0000-4000-8000-000000000002',
  '5a000000-0000-4000-8000-000000000004',
  'Spidey Opera Care Sales Meeting',
  '2026-09-01 10:00:00+10',
  '2026-09-01 10:30:00+10',
  'confirmed',
  null,
  'sandbox'
)
on conflict (id) do update set
  facility_id = excluded.facility_id,
  contact_id = excluded.contact_id,
  title = excluded.title,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  notes = excluded.notes;

commit;

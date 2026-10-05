begin;

-- Extend the proven provider research spine with an optional facility target.
-- Existing rows remain provider-scoped and all prior runs stay intact.
alter table public.account_research_jobs
  add column facility_id uuid references public.facilities(id) on delete restrict,
  add column research_scope text not null default 'provider'
    check (research_scope in ('provider', 'facility'));

alter table public.account_research_jobs
  add constraint account_research_jobs_scope_target check (
    (research_scope = 'provider' and facility_id is null)
    or (research_scope = 'facility' and facility_id is not null)
  );

alter table public.intelligence_sources
  add column source_updated_at date;

alter table public.commercial_account_facts
  add column facility_id uuid references public.facilities(id) on delete restrict;

create index commercial_account_facts_facility_idx
  on public.commercial_account_facts(facility_id, is_active, approved_at desc)
  where facility_id is not null;

create or replace function private.validate_research_job_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.facility_id is not null and not exists (
    select 1 from public.facilities facility
    where facility.id = new.facility_id
      and facility.provider_id = new.provider_id
  ) then
    raise exception 'Research facility must belong to its provider';
  end if;
  return new;
end;
$$;

create trigger account_research_jobs_validate_scope
before insert or update of provider_id, facility_id on public.account_research_jobs
for each row execute function private.validate_research_job_scope();

create or replace function private.validate_commercial_fact_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.facility_id is not null and not exists (
    select 1 from public.facilities facility
    where facility.id = new.facility_id
      and facility.provider_id = new.provider_id
  ) then
    raise exception 'Commercial fact facility must belong to its provider';
  end if;
  return new;
end;
$$;

create trigger commercial_account_facts_validate_scope
before insert or update of provider_id, facility_id on public.commercial_account_facts
for each row execute function private.validate_commercial_fact_scope();

-- Canonical imports must not be able to move a facility to a new provider while
-- scoped research memory or approved knowledge still references the old scope.
create or replace function private.protect_research_facility_provider()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider_id is distinct from old.provider_id and (
    exists (
      select 1 from public.account_research_jobs job
      where job.facility_id = new.id and job.provider_id <> new.provider_id
    )
    or exists (
      select 1 from public.commercial_account_facts fact
      where fact.facility_id = new.id and fact.provider_id <> new.provider_id
    )
  ) then
    raise exception 'Facility provider cannot change while scoped research memory references the prior provider';
  end if;
  return new;
end;
$$;

create trigger facilities_protect_research_provider
before update of provider_id on public.facilities
for each row execute function private.protect_research_facility_provider();

create index account_research_jobs_facility_idx
  on public.account_research_jobs(facility_id, requested_at desc)
  where facility_id is not null;

-- A stale request may have been abandoned by a disconnected client. It remains
-- in history as a failed run rather than blocking research forever.
update public.account_research_jobs
set status = 'failed',
    completed_at = now(),
    error_code = 'research_abandoned',
    error_message = 'Research did not complete and was closed before scoped single-flight protection was enabled.'
where status in ('queued', 'running')
  and coalesce(started_at, requested_at) < now() - interval '5 minutes';

-- Older code allowed concurrent starts. Preserve the newest active request and
-- close any other recent duplicates so the single-flight indexes can be added
-- safely to a live database as well as a clean reset.
with ranked_active_jobs as (
  select id,
         row_number() over (
           partition by provider_id, facility_id
           order by coalesce(started_at, requested_at) desc, id desc
         ) as active_rank
  from public.account_research_jobs
  where status in ('queued', 'running')
)
update public.account_research_jobs job
set status = 'failed',
    completed_at = now(),
    error_code = 'duplicate_active_reconciled',
    error_message = 'A concurrent research request was closed when scoped single-flight protection was enabled.'
from ranked_active_jobs ranked
where job.id = ranked.id
  and ranked.active_rank > 1;

create unique index account_research_jobs_one_active_provider_idx
  on public.account_research_jobs(provider_id)
  where facility_id is null and status in ('queued', 'running');

create unique index account_research_jobs_one_active_facility_idx
  on public.account_research_jobs(facility_id)
  where facility_id is not null and status in ('queued', 'running');

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
  if p_facility_id is not null and not exists (
    select 1 from public.facilities
    where id = p_facility_id
      and provider_id = p_provider_id
      and archived_at is null
  ) then
    raise exception 'Facility not found for this provider';
  end if;

  -- Recover only genuinely abandoned work. The 110-second runtime remains well
  -- inside this window, so an active request is never superseded by a retry.
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

-- Preserve the original provider-only signature for existing clients while
-- routing it through the same scoped validation and single-flight boundary.
create or replace function public.start_account_research(
  p_provider_id uuid,
  p_model text,
  p_request_context jsonb default '{}'::jsonb,
  p_provider_snapshot jsonb default '{}'::jsonb
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.start_scoped_account_research(
    p_provider_id,
    p_model,
    null,
    p_request_context,
    p_provider_snapshot
  );
$$;

create or replace function public.complete_account_research(
  p_job_id uuid,
  p_response_id text,
  p_token_usage jsonb,
  p_sources jsonb,
  p_claims jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.account_research_jobs;
  source_record jsonb;
  claim_record jsonb;
  v_claim_id uuid;
begin
  select * into job from public.account_research_jobs where id = p_job_id for update;
  if job.id is null then raise exception 'Research job not found'; end if;
  if auth.uid() is null or (job.created_by <> auth.uid() and not private.is_owner()) then
    raise exception using errcode = '42501', message = 'Not authorised for this research job';
  end if;
  if job.status <> 'running' then raise exception 'Research job is not running'; end if;

  for source_record in select value from jsonb_array_elements(coalesce(p_sources, '[]'::jsonb)) loop
    insert into public.intelligence_sources (
      provider_id, research_job_id, title, publisher, url, source_type,
      published_at, source_updated_at, retrieved_at, excerpt, created_by
    ) values (
      job.provider_id, job.id, source_record->>'title', nullif(source_record->>'publisher', ''),
      source_record->>'url', coalesce(nullif(source_record->>'source_type', ''), 'other'),
      nullif(source_record->>'published_at', '')::date,
      nullif(source_record->>'updated_at', '')::date,
      now(), nullif(source_record->>'excerpt', ''), auth.uid()
    ) on conflict (research_job_id, url) do nothing;
  end loop;

  for claim_record in select value from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb)) loop
    insert into public.intelligence_claims (
      provider_id, research_job_id, category, section, statement,
      epistemic_state, confidence, person_name, person_title,
      potential_relevance, observed_at, created_by
    ) values (
      job.provider_id, job.id, claim_record->>'category', claim_record->>'section',
      claim_record->>'statement', claim_record->>'epistemic_state',
      claim_record->>'confidence', nullif(claim_record->>'person_name', ''),
      nullif(claim_record->>'person_title', ''), nullif(claim_record->>'potential_relevance', ''),
      nullif(claim_record->>'observed_at', '')::date, auth.uid()
    ) returning id into v_claim_id;

    insert into public.intelligence_claim_sources (claim_id, source_id)
    select v_claim_id, source.id
    from public.intelligence_sources source
    where source.research_job_id = job.id
      and source.url in (
        select jsonb_array_elements_text(coalesce(claim_record->'source_urls', '[]'::jsonb))
      );

    -- A caller cannot label an unsupported assertion as known, even when it
    -- bypasses the application and invokes the RPC directly.
    update public.intelligence_claims claim
    set epistemic_state = 'unknown', confidence = 'low'
    where claim.id = v_claim_id
      and claim.epistemic_state = 'known'
      and (
        claim.observed_at is null
        or not exists (
          select 1 from public.intelligence_claim_sources link
          where link.claim_id = claim.id
        )
      );
  end loop;

  update public.account_research_jobs
  set status = 'completed', response_id = nullif(p_response_id, ''),
      token_usage = coalesce(p_token_usage, '{}'::jsonb), completed_at = now(),
      error_code = null, error_message = null
  where id = job.id;
end;
$$;

create or replace function public.fail_account_research(
  p_job_id uuid,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.account_research_jobs;
begin
  select * into job from public.account_research_jobs where id = p_job_id for update;
  if job.id is null then raise exception 'Research job not found'; end if;
  if auth.uid() is null or (job.created_by <> auth.uid() and not private.is_owner()) then
    raise exception using errcode = '42501', message = 'Not authorised for this research job';
  end if;
  if job.status <> 'running' then raise exception 'Research job is not running'; end if;

  update public.account_research_jobs
  set status = 'failed', error_code = left(coalesce(p_error_code, 'research_failed'), 100),
      error_message = left(coalesce(p_error_message, 'Research failed'), 1000), completed_at = now()
  where id = job.id;
end;
$$;

create or replace function public.review_intelligence_claim(
  p_claim_id uuid,
  p_action text,
  p_corrected_statement text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.intelligence_claims;
  final_statement text;
  claim_facility_id uuid;
begin
  if auth.uid() is null or not private.can_edit() then
    raise exception using errcode = '42501', message = 'Editor access is required';
  end if;
  if p_action not in ('approved', 'rejected', 'corrected') then
    raise exception 'Unsupported review action';
  end if;

  select * into claim from public.intelligence_claims where id = p_claim_id for update;
  if claim.id is null then raise exception 'Intelligence claim not found'; end if;
  if claim.review_status <> 'pending' then raise exception 'Claim has already been reviewed'; end if;
  if p_action in ('approved', 'corrected') and claim.epistemic_state <> 'known' then
    raise exception 'Only supported known claims can enter commercial knowledge';
  end if;
  if p_action = 'corrected' and nullif(trim(p_corrected_statement), '') is null then
    raise exception 'A corrected statement is required';
  end if;

  select job.facility_id into claim_facility_id
  from public.account_research_jobs job
  where job.id = claim.research_job_id;

  final_statement := case when p_action = 'corrected' then trim(p_corrected_statement) else claim.statement end;
  update public.intelligence_claims
  set review_status = p_action, review_note = nullif(trim(p_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = claim.id;

  if p_action in ('approved', 'corrected') then
    insert into public.commercial_account_facts (
      provider_id, facility_id, source_claim_id, category, statement,
      epistemic_state, confidence, approved_by
    ) values (
      claim.provider_id, claim_facility_id, claim.id, claim.category, final_statement,
      claim.epistemic_state, claim.confidence, auth.uid()
    );
  end if;

  insert into public.intelligence_review_events (
    claim_id, provider_id, action, previous_status,
    resulting_statement, note, reviewed_by
  ) values (
    claim.id, claim.provider_id, p_action, claim.review_status,
    case when p_action = 'rejected' then null else final_statement end,
    nullif(trim(p_note), ''), auth.uid()
  );
end;
$$;

-- Aggregate in PostgreSQL so market coverage remains exact after research
-- history grows beyond the PostgREST per-request row limit.
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
      and (
        job.facility_id is null
        or exists (
          select 1 from public.facilities facility
          where facility.id = job.facility_id and facility.archived_at is null
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

revoke all on function public.start_scoped_account_research(uuid, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.start_scoped_account_research(uuid, text, uuid, jsonb, jsonb) to authenticated;
revoke all on function public.research_coverage_snapshot(integer, timestamptz) from public, anon;
grant execute on function public.research_coverage_snapshot(integer, timestamptz) to authenticated;

commit;

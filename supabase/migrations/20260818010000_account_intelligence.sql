begin;

-- Layer C: probabilistic intelligence. Nothing here mutates canonical government
-- facts or Layer B commercial truth without an attributed human review.
create table public.account_research_jobs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  model text not null,
  request_context jsonb not null default '{}'::jsonb,
  provider_snapshot jsonb not null default '{}'::jsonb,
  response_id text,
  token_usage jsonb,
  error_code text,
  error_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint account_research_jobs_error_state check (
    (status = 'failed' and error_message is not null) or status <> 'failed'
  )
);

create index account_research_jobs_provider_idx
  on public.account_research_jobs(provider_id, requested_at desc);

create table public.intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  research_job_id uuid references public.account_research_jobs(id) on delete set null,
  title text not null,
  publisher text,
  url text not null check (url ~ '^https?://'),
  source_type text not null default 'other' check (source_type in (
    'official_provider', 'official_government', 'annual_report', 'news',
    'professional_profile', 'conference', 'other'
  )),
  published_at date,
  retrieved_at timestamptz not null default now(),
  excerpt text,
  content_hash text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (research_job_id, url)
);

create index intelligence_sources_provider_idx
  on public.intelligence_sources(provider_id, retrieved_at desc);

create table public.intelligence_claims (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  research_job_id uuid references public.account_research_jobs(id) on delete set null,
  category text not null check (category in (
    'organisation', 'person', 'signal', 'gap', 'hypothesis', 'approach'
  )),
  section text not null,
  statement text not null,
  epistemic_state text not null check (epistemic_state in ('known', 'hypothesis', 'unknown')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  person_name text,
  person_title text,
  potential_relevance text,
  observed_at date,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected', 'corrected')),
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint intelligence_claims_person_fields check (
    category <> 'person' or person_name is not null
  ),
  constraint intelligence_claims_review_attribution check (
    (review_status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (review_status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

create index intelligence_claims_provider_idx
  on public.intelligence_claims(provider_id, created_at desc);
create index intelligence_claims_review_queue_idx
  on public.intelligence_claims(review_status, provider_id, created_at desc);

create table public.intelligence_claim_sources (
  claim_id uuid not null references public.intelligence_claims(id) on delete cascade,
  source_id uuid not null references public.intelligence_sources(id) on delete cascade,
  primary key (claim_id, source_id)
);

-- Layer B: only human-approved intelligence reaches commercial truth.
create table public.commercial_account_facts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  source_claim_id uuid not null unique references public.intelligence_claims(id),
  category text not null,
  statement text not null,
  epistemic_state text not null check (epistemic_state in ('known', 'hypothesis', 'unknown')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index commercial_account_facts_provider_idx
  on public.commercial_account_facts(provider_id, is_active, approved_at desc);

create table public.intelligence_review_events (
  id bigint generated always as identity primary key,
  claim_id uuid not null references public.intelligence_claims(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  action text not null check (action in ('approved', 'rejected', 'corrected')),
  previous_status text not null,
  resulting_statement text,
  note text,
  reviewed_by uuid not null references public.profiles(id),
  reviewed_at timestamptz not null default now()
);

create or replace function public.start_account_research(
  p_provider_id uuid,
  p_model text,
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
begin
  if auth.uid() is null or not private.can_edit() then
    raise exception using errcode = '42501', message = 'Editor access is required';
  end if;
  if not exists (select 1 from public.providers where id = p_provider_id) then
    raise exception 'Provider not found';
  end if;

  insert into public.account_research_jobs (
    provider_id, status, model, request_context, provider_snapshot,
    started_at, created_by
  ) values (
    p_provider_id, 'running', p_model, coalesce(p_request_context, '{}'::jsonb),
    coalesce(p_provider_snapshot, '{}'::jsonb), now(), auth.uid()
  ) returning id into job_id;
  return job_id;
end;
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
      published_at, retrieved_at, excerpt, created_by
    ) values (
      job.provider_id, job.id, source_record->>'title', nullif(source_record->>'publisher', ''),
      source_record->>'url', coalesce(nullif(source_record->>'source_type', ''), 'other'),
      nullif(source_record->>'published_at', '')::date, now(),
      nullif(source_record->>'excerpt', ''), auth.uid()
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
  set status = 'completed', response_id = p_response_id,
      token_usage = p_token_usage, completed_at = now(),
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
  if p_action = 'corrected' and nullif(trim(p_corrected_statement), '') is null then
    raise exception 'A corrected statement is required';
  end if;

  final_statement := case when p_action = 'corrected' then trim(p_corrected_statement) else claim.statement end;
  update public.intelligence_claims
  set review_status = p_action, review_note = nullif(trim(p_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = claim.id;

  if p_action in ('approved', 'corrected') then
    insert into public.commercial_account_facts (
      provider_id, source_claim_id, category, statement,
      epistemic_state, confidence, approved_by
    ) values (
      claim.provider_id, claim.id, claim.category, final_statement,
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

alter table public.account_research_jobs enable row level security;
alter table public.intelligence_sources enable row level security;
alter table public.intelligence_claims enable row level security;
alter table public.intelligence_claim_sources enable row level security;
alter table public.commercial_account_facts enable row level security;
alter table public.intelligence_review_events enable row level security;

create policy account_research_jobs_read on public.account_research_jobs
  for select to authenticated using (true);
create policy intelligence_sources_read on public.intelligence_sources
  for select to authenticated using (true);
create policy intelligence_claims_read on public.intelligence_claims
  for select to authenticated using (true);
create policy intelligence_claim_sources_read on public.intelligence_claim_sources
  for select to authenticated using (true);
create policy commercial_account_facts_read on public.commercial_account_facts
  for select to authenticated using (true);
create policy intelligence_review_events_read on public.intelligence_review_events
  for select to authenticated using (true);

revoke all on public.account_research_jobs, public.intelligence_sources,
  public.intelligence_claims, public.intelligence_claim_sources,
  public.commercial_account_facts, public.intelligence_review_events from anon, authenticated;
revoke all on sequence public.intelligence_review_events_id_seq from anon, authenticated;

grant select on public.account_research_jobs, public.intelligence_sources,
  public.intelligence_claims, public.intelligence_claim_sources,
  public.commercial_account_facts, public.intelligence_review_events to authenticated;
revoke all on function public.start_account_research(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function public.complete_account_research(uuid, text, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.fail_account_research(uuid, text, text) from public, anon;
revoke all on function public.review_intelligence_claim(uuid, text, text, text) from public, anon;
grant execute on function public.start_account_research(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.complete_account_research(uuid, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.fail_account_research(uuid, text, text) to authenticated;
grant execute on function public.review_intelligence_claim(uuid, text, text, text) to authenticated;

commit;

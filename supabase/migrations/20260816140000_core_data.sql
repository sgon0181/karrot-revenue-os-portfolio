begin;

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  dataset_code text not null,
  title text not null,
  publisher text not null,
  source_url text,
  file_name text not null,
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  compiled_at timestamptz,
  source_as_of_date date,
  reporting_start_date date,
  reporting_end_date date,
  acquired_at timestamptz not null default now(),
  schema_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    reporting_end_date is null
    or reporting_start_date is null
    or reporting_end_date >= reporting_start_date
  )
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  importer_version text not null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_processed integer not null default 0 check (rows_processed >= 0),
  records_created integer not null default 0 check (records_created >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  matched_records integer not null default 0 check (matched_records >= 0),
  unmatched_records integer not null default 0 check (unmatched_records >= 0),
  unresolved_records integer not null default 0 check (unresolved_records >= 0),
  duplicate_candidates integer not null default 0 check (duplicate_candidates >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  details jsonb not null default '{}'::jsonb,
  error_message text,
  check (finished_at is null or finished_at >= started_at)
);

create table public.source_records (
  id bigint generated always as identity primary key,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  sheet_name text not null,
  row_number integer not null check (row_number > 0),
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  unique (source_file_id, sheet_name, row_number)
);

create trigger source_records_are_append_only
before update or delete on public.source_records
for each row execute function private.reject_mutation();

create table public.data_quality_issues (
  id bigint generated always as identity primary key,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint references public.source_records(id) on delete restrict,
  first_seen_run_id uuid references public.import_runs(id) on delete set null,
  last_seen_run_id uuid references public.import_runs(id) on delete set null,
  entity_type text,
  entity_id uuid,
  issue_code text not null,
  severity text not null check (severity in ('info', 'warning', 'error')),
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  unique (source_record_id, issue_code),
  check (resolved_at is null or resolved_at >= first_seen_at)
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  abn text not null unique check (abn ~ '^[0-9]{11}$'),
  entity_name text not null,
  business_name text not null,
  normalized_entity_name text not null,
  normalized_business_name text not null,
  registration_status text,
  current_authoritative_source_record_id bigint
    references public.source_records(id) on delete restrict,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_seen_at >= first_seen_at)
);

create trigger providers_set_updated_at
before update on public.providers
for each row execute function private.set_updated_at();

create table public.provider_snapshots (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint not null unique references public.source_records(id) on delete restrict,
  observed_at timestamptz not null,
  entity_name text not null,
  business_name text not null,
  registration_start_date date,
  registration_end_date date,
  registration_lapse_date date,
  registration_status text,
  street text,
  suburb text,
  state text,
  postcode text,
  full_address text,
  intends_special_program_delivery boolean,
  specialist_aged_care_programs text,
  suspension jsonb not null default '{}'::jsonb,
  revocation jsonb not null default '{}'::jsonb,
  banning_order jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider_id, source_file_id),
  check (
    registration_end_date is null
    or registration_start_date is null
    or registration_end_date >= registration_start_date
  )
);

create trigger provider_snapshots_are_append_only
before update or delete on public.provider_snapshots
for each row execute function private.reject_mutation();

create table public.provider_aliases (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint references public.source_records(id) on delete restrict,
  alias_type text not null check (alias_type in ('entity_name', 'business_name', 'source_name')),
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique (provider_id, source_file_id, alias_type, normalized_alias)
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  acqsc_site_id text not null unique check (length(trim(acqsc_site_id)) > 0),
  provider_id uuid not null references public.providers(id) on delete restrict,
  name text not null,
  normalized_name text not null,
  street text not null,
  suburb text not null,
  normalized_suburb text not null,
  state text not null check (state = 'NSW'),
  postcode text not null,
  full_address text not null,
  normalized_address text not null,
  current_authoritative_source_record_id bigint not null
    references public.source_records(id) on delete restrict,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_seen_at >= first_seen_at)
);

create trigger facilities_set_updated_at
before update on public.facilities
for each row execute function private.set_updated_at();

create table public.facility_snapshots (
  id bigint generated always as identity primary key,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  provider_id uuid not null references public.providers(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint not null unique references public.source_records(id) on delete restrict,
  observed_at timestamptz not null,
  acqsc_site_id text not null,
  name text not null,
  street text not null,
  suburb text not null,
  state text not null,
  postcode text not null,
  full_address text not null,
  created_at timestamptz not null default now(),
  unique (facility_id, source_file_id)
);

create trigger facility_snapshots_are_append_only
before update or delete on public.facility_snapshots
for each row execute function private.reject_mutation();

create table public.facility_aliases (
  id bigint generated always as identity primary key,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint references public.source_records(id) on delete restrict,
  alias text not null,
  normalized_alias text not null,
  suburb text,
  normalized_suburb text,
  provider_alias text,
  normalized_provider_alias text,
  created_at timestamptz not null default now(),
  unique (facility_id, source_file_id, normalized_alias, normalized_suburb)
);

create table public.provider_service_types (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint not null references public.source_records(id) on delete restrict,
  registration_category text not null,
  service_type text not null,
  unique (provider_id, source_file_id, registration_category, service_type)
);

create table public.provider_lgas (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint not null references public.source_records(id) on delete restrict,
  registration_category text not null,
  lga text not null,
  unique (provider_id, source_file_id, registration_category, lga)
);

create table public.provider_regulatory_notices (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint not null unique references public.source_records(id) on delete restrict,
  starts_on date,
  ends_on date,
  detail_url text,
  issued_by text,
  status text,
  notice_type text,
  detail text,
  required_action text,
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.facility_match_decisions (
  id bigint generated always as identity primary key,
  source_record_id bigint not null unique references public.source_records(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  dataset_code text not null,
  facility_id uuid references public.facilities(id) on delete restrict,
  status text not null check (
    status in ('auto_confirmed', 'confirmed', 'review_required', 'unmatched', 'rejected')
  ),
  match_method text not null,
  evidence jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('auto_confirmed', 'confirmed') and facility_id is not null)
    or (status not in ('auto_confirmed', 'confirmed'))
  )
);

create trigger facility_match_decisions_set_updated_at
before update on public.facility_match_decisions
for each row execute function private.set_updated_at();

create table public.facility_match_candidates (
  id bigint generated always as identity primary key,
  decision_id bigint not null references public.facility_match_decisions(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  candidate_rank integer not null check (candidate_rank > 0),
  match_rule text not null,
  signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (decision_id, facility_id),
  unique (decision_id, candidate_rank)
);

create table public.star_rating_snapshots (
  id bigint generated always as identity primary key,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint not null unique references public.source_records(id) on delete restrict,
  reporting_period text not null,
  reporting_month date not null,
  observed_provider_name text not null,
  purpose text,
  aged_care_planning_region text,
  state text not null,
  mmm_region text,
  mmm_code text check (mmm_code is null or mmm_code in ('MM1', 'MM2', 'MM3', 'MM4', 'MM5', 'MM6', 'MM7')),
  size_band text,
  overall_rating smallint check (overall_rating between 1 and 5),
  residents_experience_rating smallint check (residents_experience_rating between 1 and 5),
  compliance_rating smallint check (compliance_rating between 1 and 5),
  staffing_rating smallint check (staffing_rating between 1 and 5),
  quality_measures_rating smallint check (quality_measures_rating between 1 and 5),
  interview_year smallint,
  rn_minutes_target numeric check (rn_minutes_target >= 0),
  rn_minutes_actual numeric check (rn_minutes_actual >= 0),
  total_minutes_target numeric check (total_minutes_target >= 0),
  total_minutes_actual numeric check (total_minutes_actual >= 0),
  residents_experience_detail jsonb not null default '{}'::jsonb,
  compliance_detail jsonb not null default '{}'::jsonb,
  quality_measures_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (facility_id, reporting_month, source_file_id)
);

create trigger star_rating_snapshots_are_append_only
before update or delete on public.star_rating_snapshots
for each row execute function private.reject_mutation();

create table public.care_minutes_snapshots (
  id bigint generated always as identity primary key,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  source_file_id uuid not null references public.source_files(id) on delete restrict,
  source_record_id bigint not null unique references public.source_records(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  observed_home_name text not null,
  observed_provider_name text not null,
  home_size_band text,
  suburb text,
  mmm_location smallint check (mmm_location between 1 and 7),
  state text not null,
  longitude numeric check (longitude between -180 and 180),
  latitude numeric check (latitude between -90 and 90),
  address text,
  total_minutes_target numeric check (total_minutes_target >= 0),
  total_minutes_actual numeric check (total_minutes_actual >= 0),
  total_target_percentage numeric check (total_target_percentage >= 0),
  rn_minutes_target numeric check (rn_minutes_target >= 0),
  rn_performance numeric check (rn_performance >= 0),
  rn_target_percentage numeric check (rn_target_percentage >= 0),
  met_responsibility boolean,
  rn_minutes_actual numeric check (rn_minutes_actual >= 0),
  en_minutes_actual numeric check (en_minutes_actual >= 0),
  created_at timestamptz not null default now(),
  unique (facility_id, period_start, source_file_id),
  check (period_end >= period_start)
);

create trigger care_minutes_snapshots_are_append_only
before update or delete on public.care_minutes_snapshots
for each row execute function private.reject_mutation();

create or replace function private.protect_snapshotted_match_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_facility_id uuid;
  snapshot_dataset_code text;
begin
  select snapshot.facility_id, snapshot.dataset_code
  into snapshot_facility_id, snapshot_dataset_code
  from (
    select facility_id, 'star_ratings'::text as dataset_code
    from public.star_rating_snapshots
    where source_record_id = old.source_record_id
    union all
    select facility_id, 'care_minutes'::text as dataset_code
    from public.care_minutes_snapshots
    where source_record_id = old.source_record_id
  ) snapshot
  limit 1;

  if snapshot_facility_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Cannot delete a match decision that has an immutable snapshot';
  end if;

  if new.source_record_id is distinct from old.source_record_id
    or new.dataset_code is distinct from snapshot_dataset_code
    or new.facility_id is distinct from snapshot_facility_id
    or new.status not in ('auto_confirmed', 'confirmed')
  then
    raise exception 'Cannot remap or reject a match decision that has an immutable snapshot';
  end if;

  return new;
end;
$$;

create trigger match_decisions_protect_immutable_snapshots
before update or delete on public.facility_match_decisions
for each row execute function private.protect_snapshotted_match_decision();

create index providers_normalized_business_name_trgm_idx
  on public.providers using gin (normalized_business_name extensions.gin_trgm_ops);
create index providers_registration_status_idx on public.providers (registration_status);
create index facilities_provider_idx on public.facilities (provider_id);
create index facilities_location_idx on public.facilities (state, postcode, suburb);
create index facilities_normalized_name_trgm_idx
  on public.facilities using gin (normalized_name extensions.gin_trgm_ops);
create index facilities_normalized_address_idx on public.facilities (normalized_address);
create index source_records_file_sheet_idx
  on public.source_records (source_file_id, sheet_name, row_number);
create index data_quality_open_idx
  on public.data_quality_issues (severity, issue_code)
  where status = 'open';
create index match_decisions_review_idx
  on public.facility_match_decisions (dataset_code, status)
  where status in ('review_required', 'unmatched');
create index star_ratings_facility_period_idx
  on public.star_rating_snapshots (facility_id, reporting_month desc);
create index care_minutes_facility_period_idx
  on public.care_minutes_snapshots (facility_id, period_end desc);

commit;

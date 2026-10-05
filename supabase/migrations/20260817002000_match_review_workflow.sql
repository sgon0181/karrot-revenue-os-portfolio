begin;

create table public.facility_match_review_events (
  id bigint generated always as identity primary key,
  decision_id bigint not null references public.facility_match_decisions(id) on delete restrict,
  action text not null check (action in ('confirm', 'reject', 'reset')),
  from_status text not null,
  to_status text not null,
  facility_id uuid references public.facilities(id) on delete restrict,
  review_note text not null check (length(trim(review_note)) >= 3),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now()
);

create trigger facility_match_review_events_are_append_only
before update or delete on public.facility_match_review_events
for each row execute function private.reject_mutation();

create index facility_match_review_events_decision_idx
  on public.facility_match_review_events (decision_id, reviewed_at desc);

alter table public.facility_match_review_events enable row level security;
create policy facility_match_review_events_read
on public.facility_match_review_events for select to authenticated using (true);

create or replace function private.jsonb_numeric(payload jsonb, field_name text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw_value text;
begin
  raw_value := nullif(trim(payload ->> field_name), '');
  if raw_value is null or lower(raw_value) in ('nan', 'n/a', 'not applicable') then
    return null;
  end if;
  return raw_value::numeric;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return null;
end;
$$;

create or replace function public.review_facility_match(
  p_decision_id bigint,
  p_action text,
  p_facility_id uuid default null,
  p_review_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision_row public.facility_match_decisions%rowtype;
  source_row public.source_records%rowtype;
  reviewer_id uuid := auth.uid();
  normalized_action text := lower(trim(p_action));
  normalized_note text := trim(coalesce(p_review_note, ''));
  destination_status text;
  target_reporting_month date;
  target_care_period_start date;
  target_care_period_end date;
begin
  if reviewer_id is null or not private.can_edit() then
    raise exception 'Only authenticated editors or owners can review facility matches'
      using errcode = '42501';
  end if;

  if normalized_action not in ('confirm', 'reject', 'reset') then
    raise exception 'Review action must be confirm, reject, or reset';
  end if;

  if length(normalized_note) < 3 then
    raise exception 'A review note of at least 3 characters is required';
  end if;

  select * into decision_row
  from public.facility_match_decisions
  where id = p_decision_id
  for update;

  if not found then
    raise exception 'Facility match decision % does not exist', p_decision_id;
  end if;

  if normalized_action in ('confirm', 'reject')
    and decision_row.status not in ('review_required', 'unmatched')
  then
    raise exception 'Only unresolved or unmatched decisions can be confirmed or rejected';
  end if;

  if normalized_action = 'reset' and decision_row.status <> 'rejected' then
    raise exception 'Only a rejected decision can be returned to review';
  end if;

  select * into source_row
  from public.source_records
  where id = decision_row.source_record_id;

  if normalized_action = 'confirm' then
    if p_facility_id is null then
      raise exception 'A facility is required when confirming a match';
    end if;

    if not exists (
      select 1 from public.facilities f
      where f.id = p_facility_id and f.archived_at is null
    ) then
      raise exception 'The selected facility does not exist or is archived';
    end if;

    if exists (
      select 1 from public.facility_match_candidates c
      where c.decision_id = p_decision_id
    ) and not exists (
      select 1 from public.facility_match_candidates c
      where c.decision_id = p_decision_id and c.facility_id = p_facility_id
    ) then
      raise exception 'The selected facility is not a recorded candidate for this decision';
    end if;

    update public.facility_match_decisions set
      facility_id = p_facility_id,
      status = 'confirmed',
      match_method = 'manual_confirmed',
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      review_note = normalized_note
    where id = p_decision_id;

    if decision_row.dataset_code = 'star_ratings' then
      target_reporting_month := to_date(source_row.raw_data ->> 'Reporting Period', 'Month YYYY');

      if exists (
        select 1 from public.star_rating_snapshots s
        where s.facility_id = p_facility_id
          and s.reporting_month = target_reporting_month
          and s.source_file_id = decision_row.source_file_id
      ) then
        raise exception 'That facility already has a Star Rating snapshot for this source period';
      end if;

      insert into public.star_rating_snapshots (
        facility_id, source_file_id, source_record_id, reporting_period,
        reporting_month, observed_provider_name, purpose,
        aged_care_planning_region, state, mmm_region, mmm_code,
        size_band, overall_rating, residents_experience_rating,
        compliance_rating, staffing_rating, quality_measures_rating,
        interview_year, rn_minutes_target, rn_minutes_actual,
        total_minutes_target, total_minutes_actual,
        residents_experience_detail, compliance_detail, quality_measures_detail
      ) values (
        p_facility_id,
        decision_row.source_file_id,
        decision_row.source_record_id,
        source_row.raw_data ->> 'Reporting Period',
        target_reporting_month,
        source_row.raw_data ->> 'Provider Name',
        nullif(trim(source_row.raw_data ->> 'Purpose'), ''),
        nullif(trim(source_row.raw_data ->> 'Aged Care Planning Region'), ''),
        source_row.raw_data ->> 'State/Territory',
        nullif(trim(source_row.raw_data ->> 'MMM Region'), ''),
        nullif(trim(source_row.raw_data ->> 'MMM Code'), ''),
        nullif(trim(source_row.raw_data ->> 'Size'), ''),
        case when private.jsonb_numeric(source_row.raw_data, 'Overall Star Rating') between 1 and 5
          then private.jsonb_numeric(source_row.raw_data, 'Overall Star Rating')::smallint end,
        case when private.jsonb_numeric(source_row.raw_data, 'Residents'' Experience rating') between 1 and 5
          then private.jsonb_numeric(source_row.raw_data, 'Residents'' Experience rating')::smallint end,
        case when private.jsonb_numeric(source_row.raw_data, 'Compliance rating') between 1 and 5
          then private.jsonb_numeric(source_row.raw_data, 'Compliance rating')::smallint end,
        case when private.jsonb_numeric(source_row.raw_data, 'Staffing rating') between 1 and 5
          then private.jsonb_numeric(source_row.raw_data, 'Staffing rating')::smallint end,
        case when private.jsonb_numeric(source_row.raw_data, 'Quality Measures rating') between 1 and 5
          then private.jsonb_numeric(source_row.raw_data, 'Quality Measures rating')::smallint end,
        private.jsonb_numeric(source_row.raw_data, '[RE] Interview Year')::smallint,
        private.jsonb_numeric(source_row.raw_data, '[S] Registered Nurse Care Minutes - Target'),
        private.jsonb_numeric(source_row.raw_data, '[S] Registered Nurse Care Minutes - Actual'),
        private.jsonb_numeric(source_row.raw_data, '[S] Total Care Minutes - Target'),
        private.jsonb_numeric(source_row.raw_data, '[S] Total Care Minutes - Actual'),
        (
          select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
          from jsonb_each(source_row.raw_data) entry
          where entry.key like '[RE]%'
        ),
        (
          select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
          from jsonb_each(source_row.raw_data) entry
          where entry.key like '[C]%'
        ),
        (
          select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
          from jsonb_each(source_row.raw_data) entry
          where entry.key like '[QM]%'
        )
      );
    elsif decision_row.dataset_code = 'care_minutes' then
      select period_start, period_end
      into target_care_period_start, target_care_period_end
      from (
        values
          ('Jul-Sep 2025'::text, date '2025-07-01', date '2025-09-30'),
          ('Oct-Dec 2025'::text, date '2025-10-01', date '2025-12-31'),
          ('Jan-Mar 2026'::text, date '2026-01-01', date '2026-03-31')
      ) as periods(sheet_name, period_start, period_end)
      where periods.sheet_name = source_row.sheet_name;

      if target_care_period_start is null then
        raise exception 'Unknown care-minutes reporting sheet: %', source_row.sheet_name;
      end if;

      if exists (
        select 1 from public.care_minutes_snapshots s
        where s.facility_id = p_facility_id
          and s.period_start = target_care_period_start
          and s.source_file_id = decision_row.source_file_id
      ) then
        raise exception 'That facility already has a care-minutes snapshot for this source period';
      end if;

      insert into public.care_minutes_snapshots (
        facility_id, source_file_id, source_record_id, period_start,
        period_end, observed_home_name, observed_provider_name,
        home_size_band, suburb, mmm_location, state, longitude,
        latitude, address, total_minutes_target, total_minutes_actual,
        total_target_percentage, rn_minutes_target, rn_performance,
        rn_target_percentage, met_responsibility, rn_minutes_actual,
        en_minutes_actual
      ) values (
        p_facility_id,
        decision_row.source_file_id,
        decision_row.source_record_id,
        target_care_period_start,
        target_care_period_end,
        source_row.raw_data ->> 'Home Name',
        source_row.raw_data ->> 'Provider Name',
        (
          select nullif(trim(entry.value), '')
          from jsonb_each_text(source_row.raw_data) entry
          where entry.key like 'Home Size%'
          limit 1
        ),
        nullif(trim(source_row.raw_data ->> 'Suburb'), ''),
        private.jsonb_numeric(source_row.raw_data, 'MMM Location')::smallint,
        source_row.raw_data ->> 'State',
        private.jsonb_numeric(source_row.raw_data, 'Longitude'),
        private.jsonb_numeric(source_row.raw_data, 'Latitude'),
        nullif(trim(source_row.raw_data ->> 'Address'), ''),
        private.jsonb_numeric(source_row.raw_data, 'Total Direct Care Minutes Target'),
        private.jsonb_numeric(source_row.raw_data, 'Actual Total Direct Care Minutes Delivered'),
        private.jsonb_numeric(source_row.raw_data, '% of total care minutes target delivered'),
        private.jsonb_numeric(source_row.raw_data, 'RN Minutes Target'),
        private.jsonb_numeric(source_row.raw_data, 'Actual RN Performance*'),
        private.jsonb_numeric(source_row.raw_data, '% of RN target delivered'),
        case upper(trim(coalesce(source_row.raw_data ->> 'Met care minutes responsibility (Yes/No)', '')))
          when 'YES' then true when 'NO' then false else null end,
        private.jsonb_numeric(source_row.raw_data, 'Actual RN Minutes Delivered'),
        private.jsonb_numeric(source_row.raw_data, 'Actual EN Minutes Delivered')
      );
    else
      raise exception 'Dataset % does not support manual snapshot creation', decision_row.dataset_code;
    end if;

    destination_status := 'confirmed';
  elsif normalized_action = 'reject' then
    update public.facility_match_decisions set
      facility_id = null,
      status = 'rejected',
      match_method = 'manual_rejected',
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      review_note = normalized_note
    where id = p_decision_id;
    destination_status := 'rejected';
  else
    update public.facility_match_decisions set
      facility_id = null,
      status = 'review_required',
      match_method = 'manual_review_reset',
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      review_note = normalized_note
    where id = p_decision_id;
    destination_status := 'review_required';
  end if;

  insert into public.facility_match_review_events (
    decision_id, action, from_status, to_status, facility_id,
    review_note, reviewed_by
  ) values (
    p_decision_id,
    normalized_action,
    decision_row.status,
    destination_status,
    case when normalized_action = 'confirm' then p_facility_id else null end,
    normalized_note,
    reviewer_id
  );

  update public.data_quality_issues set
    status = case when destination_status = 'review_required' then 'open' else 'resolved' end,
    resolved_at = case when destination_status = 'review_required' then null else now() end,
    resolution_note = normalized_note,
    last_seen_at = now()
  where source_record_id = decision_row.source_record_id
    and issue_code in ('star_rating_match_review', 'star_rating_unmatched',
                       'care_minutes_match_review', 'care_minutes_unmatched');

  return p_decision_id;
end;
$$;

create view public.v_match_review_history
with (security_invoker = true)
as
select
  event.id,
  event.decision_id,
  event.action,
  event.from_status,
  event.to_status,
  event.facility_id,
  facility.acqsc_site_id,
  facility.name as facility_name,
  event.review_note,
  event.reviewed_by,
  profile.display_name as reviewer_name,
  event.reviewed_at,
  decision.dataset_code,
  source.sheet_name,
  source.row_number,
  file.file_name
from public.facility_match_review_events event
join public.facility_match_decisions decision on decision.id = event.decision_id
join public.source_records source on source.id = decision.source_record_id
join public.source_files file on file.id = source.source_file_id
left join public.facilities facility on facility.id = event.facility_id
left join public.profiles profile on profile.id = event.reviewed_by;

revoke all on function public.review_facility_match(bigint, text, uuid, text) from public;
grant execute on function public.review_facility_match(bigint, text, uuid, text) to authenticated, service_role;
grant select on public.facility_match_review_events, public.v_match_review_history to authenticated;
grant all on public.facility_match_review_events to service_role;
grant usage, select on sequence public.facility_match_review_events_id_seq to service_role;

commit;

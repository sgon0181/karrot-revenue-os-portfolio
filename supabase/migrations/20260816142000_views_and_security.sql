begin;

create view public.v_provider_overview
with (security_invoker = true)
as
select
  p.id,
  p.abn,
  p.entity_name,
  p.business_name,
  p.registration_status,
  p.first_seen_at,
  p.last_seen_at,
  coalesce(f.facility_count, 0)::bigint as facility_count,
  coalesce(c.contact_count, 0)::bigint as contact_count,
  coalesce(o.open_opportunity_count, 0)::bigint as open_opportunity_count,
  current_activity.stage_name as current_commercial_activity,
  customer.status as customer_status,
  latest_activity.occurred_at as last_activity_at,
  next_action.title as next_action,
  next_action.due_at as next_action_due_at
from public.providers p
left join lateral (
  select count(*) as facility_count
  from public.facilities f0
  where f0.provider_id = p.id and f0.archived_at is null
) f on true
left join lateral (
  select count(*) as contact_count
  from public.contacts c0
  where c0.provider_id = p.id
) c on true
left join lateral (
  select count(*) as open_opportunity_count
  from public.opportunities o0
  join public.pipeline_stages ps0 on ps0.id = o0.stage_id
  where o0.provider_id = p.id and ps0.outcome is null
) o on true
left join lateral (
  select ps1.name as stage_name
  from public.opportunities o1
  join public.pipeline_stages ps1 on ps1.id = o1.stage_id
  where o1.provider_id = p.id
  order by o1.updated_at desc
  limit 1
) current_activity on true
left join public.customer_relationships customer on customer.provider_id = p.id
left join lateral (
  select a.occurred_at
  from public.activities a
  where a.provider_id = p.id
  order by a.occurred_at desc
  limit 1
) latest_activity on true
left join lateral (
  select na.title, na.due_at
  from public.next_actions na
  where na.provider_id = p.id and na.status = 'open'
  order by na.due_at asc nulls last, na.created_at asc
  limit 1
) next_action on true
where p.archived_at is null;

create view public.v_facility_latest
with (security_invoker = true)
as
select
  f.id,
  f.acqsc_site_id,
  f.provider_id,
  p.business_name as provider_name,
  f.name,
  f.street,
  f.suburb,
  f.state,
  f.postcode,
  f.full_address,
  sr.reporting_month as star_reporting_month,
  sr.observed_provider_name as star_observed_provider_name,
  sr.source_file_name as star_source_file_name,
  sr.source_sheet_name as star_source_sheet_name,
  sr.source_row_number as star_source_row_number,
  sr.source_sha256 as star_source_sha256,
  sr.source_url as star_source_url,
  sr.overall_rating,
  sr.residents_experience_rating,
  sr.compliance_rating,
  sr.staffing_rating,
  sr.quality_measures_rating,
  cm.period_end as care_minutes_period_end,
  cm.observed_provider_name as care_observed_provider_name,
  cm.source_file_name as care_source_file_name,
  cm.source_sheet_name as care_source_sheet_name,
  cm.source_row_number as care_source_row_number,
  cm.source_sha256 as care_source_sha256,
  cm.source_url as care_source_url,
  cm.home_size_band as approved_bed_size_band,
  cm.total_minutes_target,
  cm.total_minutes_actual,
  cm.total_target_percentage,
  cm.rn_minutes_target,
  cm.rn_minutes_actual,
  cm.rn_target_percentage,
  cm.met_responsibility,
  cm.longitude,
  cm.latitude
from public.facilities f
join public.providers p on p.id = f.provider_id
left join lateral (
  select
    s.*,
    source_record.sheet_name as source_sheet_name,
    source_record.row_number as source_row_number,
    source_file.file_name as source_file_name,
    source_file.sha256 as source_sha256,
    source_file.source_url
  from public.star_rating_snapshots s
  join public.source_records source_record on source_record.id = s.source_record_id
  join public.source_files source_file on source_file.id = s.source_file_id
  where s.facility_id = f.id
  order by s.reporting_month desc, s.id desc
  limit 1
) sr on true
left join lateral (
  select
    c.*,
    source_record.sheet_name as source_sheet_name,
    source_record.row_number as source_row_number,
    source_file.file_name as source_file_name,
    source_file.sha256 as source_sha256,
    source_file.source_url
  from public.care_minutes_snapshots c
  join public.source_records source_record on source_record.id = c.source_record_id
  join public.source_files source_file on source_file.id = c.source_file_id
  where c.facility_id = f.id
  order by c.period_end desc, c.id desc
  limit 1
) cm on true
where f.archived_at is null;

create view public.v_pipeline_board
with (security_invoker = true)
as
select
  o.id,
  o.provider_id,
  p.business_name as provider_name,
  o.name,
  o.stage_id,
  ps.code as stage_code,
  ps.name as stage_name,
  ps.position as stage_position,
  ps.color as stage_color,
  o.stage_entered_at,
  floor(extract(epoch from (now() - o.stage_entered_at)) / 86400)::integer as days_in_stage,
  o.primary_contact_id,
  c.full_name as primary_contact_name,
  o.owner_id,
  o.estimated_value,
  o.currency,
  o.estimated_beds,
  o.expected_close_date,
  o.notes,
  o.updated_at,
  latest_activity.occurred_at as last_activity_at,
  case
    when latest_activity.occurred_at is null then null
    else floor(extract(epoch from (now() - latest_activity.occurred_at)) / 86400)::integer
  end as days_since_last_activity,
  next_action.id as next_action_id,
  next_action.title as next_action,
  next_action.due_at as next_action_due_at,
  coalesce(next_action.due_at < now(), false) as next_action_overdue
from public.opportunities o
join public.providers p on p.id = o.provider_id
join public.pipeline_stages ps on ps.id = o.stage_id
left join public.contacts c on c.id = o.primary_contact_id
left join lateral (
  select a.occurred_at
  from public.activities a
  where a.opportunity_id = o.id
  order by a.occurred_at desc
  limit 1
) latest_activity on true
left join lateral (
  select na.id, na.title, na.due_at
  from public.next_actions na
  where na.opportunity_id = o.id and na.status = 'open'
  order by na.due_at asc nulls last, na.created_at asc
  limit 1
) next_action on true
where ps.outcome is null and ps.is_active;

create view public.v_customer_overview
with (security_invoker = true)
as
select
  cr.id,
  cr.provider_id,
  p.business_name as provider_name,
  p.abn,
  cr.customer_since,
  cr.contract_start_date,
  cr.contract_end_date,
  cr.renewal_date,
  cr.onboarding_state,
  cr.status,
  cr.mrr,
  cr.arr,
  cr.contracted_beds,
  coalesce(cf.facilities_contracted, 0)::bigint as facilities_contracted,
  coalesce(cf.facilities_live, 0)::bigint as facilities_live,
  coalesce(cf.beds_live, 0)::bigint as beds_live,
  cr.updated_at
from public.customer_relationships cr
join public.providers p on p.id = cr.provider_id
left join lateral (
  select
    count(*) filter (where c0.status in ('contracted', 'onboarding', 'live', 'paused')) as facilities_contracted,
    count(*) filter (where c0.status = 'live') as facilities_live,
    coalesce(sum(c0.live_beds) filter (where c0.status = 'live'), 0) as beds_live
  from public.customer_facilities c0
  where c0.customer_relationship_id = cr.id
) cf on true;

create view public.v_data_import_health
with (security_invoker = true)
as
select
  sf.id as source_file_id,
  sf.dataset_code,
  sf.title,
  sf.publisher,
  sf.source_url,
  sf.file_name,
  sf.sha256,
  sf.source_as_of_date,
  sf.reporting_start_date,
  sf.reporting_end_date,
  latest_run.id as latest_run_id,
  latest_run.started_at as latest_import_started_at,
  latest_run.finished_at as latest_import_finished_at,
  latest_run.status as latest_import_status,
  latest_run.rows_processed,
  latest_run.records_created,
  latest_run.records_updated,
  latest_run.matched_records,
  latest_run.unmatched_records,
  latest_run.unresolved_records,
  latest_run.duplicate_candidates,
  latest_run.error_count,
  coalesce(issues.open_issues, 0)::bigint as open_issues,
  coalesce(issues.open_errors, 0)::bigint as open_errors
from public.source_files sf
left join lateral (
  select ir.*
  from public.import_runs ir
  where ir.source_file_id = sf.id
  order by ir.started_at desc
  limit 1
) latest_run on true
left join lateral (
  select
    count(*) filter (where dqi.status = 'open') as open_issues,
    count(*) filter (where dqi.status = 'open' and dqi.severity = 'error') as open_errors
  from public.data_quality_issues dqi
  where dqi.source_file_id = sf.id
) issues on true;

create view public.v_match_review_queue
with (security_invoker = true)
as
select
  md.id,
  md.dataset_code,
  md.status,
  md.match_method,
  md.evidence,
  md.created_at,
  sr.source_file_id,
  sf.file_name,
  sr.sheet_name,
  sr.row_number,
  sr.raw_data,
  coalesce(candidates.candidate_count, 0)::bigint as candidate_count,
  candidates.candidates
from public.facility_match_decisions md
join public.source_records sr on sr.id = md.source_record_id
join public.source_files sf on sf.id = sr.source_file_id
left join lateral (
  select
    count(*) as candidate_count,
    jsonb_agg(
      jsonb_build_object(
        'facility_id', f.id,
        'site_id', f.acqsc_site_id,
        'facility_name', f.name,
        'suburb', f.suburb,
        'provider_name', p.business_name,
        'rank', mc.candidate_rank,
        'rule', mc.match_rule,
        'signals', mc.signals
      ) order by mc.candidate_rank
    ) as candidates
  from public.facility_match_candidates mc
  join public.facilities f on f.id = mc.facility_id
  join public.providers p on p.id = f.provider_id
  where mc.decision_id = md.id
) candidates on true
where md.status in ('review_required', 'unmatched');

create view public.v_opportunities_by_stage
with (security_invoker = true)
as
select
  ps.id as stage_id,
  ps.code,
  ps.name,
  ps.position,
  ps.color,
  count(o.id)::bigint as opportunity_count,
  coalesce(sum(o.estimated_value), 0)::numeric as estimated_value
from public.pipeline_stages ps
left join public.opportunities o on o.stage_id = ps.id
where ps.is_active and ps.outcome is null
group by ps.id, ps.code, ps.name, ps.position, ps.color;

create view public.v_dashboard_metrics
with (security_invoker = true)
as
select
  (select count(*) from public.providers where archived_at is null)::bigint as nsw_providers,
  (select count(*) from public.facilities where archived_at is null and state = 'NSW')::bigint as nsw_facilities,
  (select count(*) from public.contacts)::bigint as contacts,
  (
    select count(*)
    from public.opportunities o
    join public.pipeline_stages ps on ps.id = o.stage_id
    where ps.outcome is null
  )::bigint as active_opportunities,
  (select count(*) from public.next_actions where status = 'open' and due_at is not null)::bigint as actions_due,
  (select count(*) from public.next_actions where status = 'open' and due_at < now())::bigint as overdue_actions,
  (select count(*) from public.customer_relationships where status = 'active')::bigint as active_customers,
  (select count(*) from public.customer_facilities where status = 'live')::bigint as facilities_live,
  coalesce((select sum(live_beds) from public.customer_facilities where status = 'live'), 0)::bigint as beds_live,
  (select sum(mrr) from public.customer_relationships where status = 'active')::numeric as mrr,
  (select sum(arr) from public.customer_relationships where status = 'active')::numeric as arr;

create or replace function private.can_edit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'editor')
  );
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  );
$$;

revoke all on function private.can_edit() from public;
revoke all on function private.is_owner() from public;
grant execute on function private.can_edit() to authenticated;
grant execute on function private.is_owner() to authenticated;

alter table public.source_files enable row level security;
alter table public.import_runs enable row level security;
alter table public.source_records enable row level security;
alter table public.data_quality_issues enable row level security;
alter table public.providers enable row level security;
alter table public.provider_snapshots enable row level security;
alter table public.provider_aliases enable row level security;
alter table public.facilities enable row level security;
alter table public.facility_snapshots enable row level security;
alter table public.facility_aliases enable row level security;
alter table public.provider_service_types enable row level security;
alter table public.provider_lgas enable row level security;
alter table public.provider_regulatory_notices enable row level security;
alter table public.facility_match_decisions enable row level security;
alter table public.facility_match_candidates enable row level security;
alter table public.star_rating_snapshots enable row level security;
alter table public.care_minutes_snapshots enable row level security;
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_stage_history enable row level security;
alter table public.activities enable row level security;
alter table public.next_actions enable row level security;
alter table public.customer_relationships enable row level security;
alter table public.customer_facilities enable row level security;

create policy source_files_read on public.source_files for select to authenticated using (true);
create policy import_runs_read on public.import_runs for select to authenticated using (true);
create policy source_records_read on public.source_records for select to authenticated using (true);
create policy data_quality_read on public.data_quality_issues for select to authenticated using (true);
create policy providers_read on public.providers for select to authenticated using (true);
create policy provider_snapshots_read on public.provider_snapshots for select to authenticated using (true);
create policy provider_aliases_read on public.provider_aliases for select to authenticated using (true);
create policy facilities_read on public.facilities for select to authenticated using (true);
create policy facility_snapshots_read on public.facility_snapshots for select to authenticated using (true);
create policy facility_aliases_read on public.facility_aliases for select to authenticated using (true);
create policy provider_service_types_read on public.provider_service_types for select to authenticated using (true);
create policy provider_lgas_read on public.provider_lgas for select to authenticated using (true);
create policy provider_notices_read on public.provider_regulatory_notices for select to authenticated using (true);
create policy match_decisions_read on public.facility_match_decisions for select to authenticated using (true);
create policy match_candidates_read on public.facility_match_candidates for select to authenticated using (true);
create policy star_ratings_read on public.star_rating_snapshots for select to authenticated using (true);
create policy care_minutes_read on public.care_minutes_snapshots for select to authenticated using (true);
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy contacts_read on public.contacts for select to authenticated using (true);
create policy contacts_write on public.contacts for all to authenticated
  using (private.can_edit()) with check (private.can_edit());
create policy pipeline_stages_read on public.pipeline_stages for select to authenticated using (true);
create policy pipeline_stages_write on public.pipeline_stages for all to authenticated
  using (private.is_owner()) with check (private.is_owner());
create policy opportunities_read on public.opportunities for select to authenticated using (true);
create policy opportunities_write on public.opportunities for all to authenticated
  using (private.can_edit()) with check (private.can_edit());
create policy stage_history_read on public.opportunity_stage_history for select to authenticated using (true);
create policy activities_read on public.activities for select to authenticated using (true);
create policy activities_write on public.activities for all to authenticated
  using (private.can_edit()) with check (private.can_edit());
create policy next_actions_read on public.next_actions for select to authenticated using (true);
create policy next_actions_write on public.next_actions for all to authenticated
  using (private.can_edit()) with check (private.can_edit());
create policy customer_relationships_read on public.customer_relationships for select to authenticated using (true);
create policy customer_relationships_write on public.customer_relationships for all to authenticated
  using (private.can_edit()) with check (private.can_edit());
create policy customer_facilities_read on public.customer_facilities for select to authenticated using (true);
create policy customer_facilities_write on public.customer_facilities for all to authenticated
  using (private.can_edit()) with check (private.can_edit());

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select on
  public.source_files,
  public.import_runs,
  public.source_records,
  public.data_quality_issues,
  public.providers,
  public.provider_snapshots,
  public.provider_aliases,
  public.facilities,
  public.facility_snapshots,
  public.facility_aliases,
  public.provider_service_types,
  public.provider_lgas,
  public.provider_regulatory_notices,
  public.facility_match_decisions,
  public.facility_match_candidates,
  public.star_rating_snapshots,
  public.care_minutes_snapshots,
  public.profiles,
  public.opportunity_stage_history,
  public.v_provider_overview,
  public.v_facility_latest,
  public.v_pipeline_board,
  public.v_customer_overview,
  public.v_data_import_health,
  public.v_match_review_queue,
  public.v_opportunities_by_stage,
  public.v_dashboard_metrics
to authenticated;

grant select on
  public.contacts,
  public.pipeline_stages,
  public.opportunities,
  public.activities,
  public.next_actions,
  public.customer_relationships,
  public.customer_facilities
to authenticated;

grant insert (
  provider_id, facility_id, full_name, title, email, phone,
  professional_profile_url, role_category, relationship_status,
  source_type, source_url, last_verified_at, notes
) on public.contacts to authenticated;
grant update (
  facility_id, full_name, title, email, phone, professional_profile_url,
  role_category, relationship_status, source_type, source_url,
  last_verified_at, notes
) on public.contacts to authenticated;

grant insert (code, name, position, color, outcome, is_active)
on public.pipeline_stages to authenticated;
grant update (code, name, position, color, is_active)
on public.pipeline_stages to authenticated;
grant delete on public.pipeline_stages to authenticated;

grant insert (
  provider_id, name, stage_id, primary_contact_id, owner_id, notes,
  estimated_value, currency, estimated_beds, expected_close_date,
  closed_lost_reason
) on public.opportunities to authenticated;
grant update (
  name, stage_id, primary_contact_id, owner_id, notes, estimated_value,
  currency, estimated_beds, expected_close_date, closed_lost_reason
) on public.opportunities to authenticated;

grant insert (
  provider_id, facility_id, opportunity_id, contact_id, activity_type,
  subject, notes, occurred_at
) on public.activities to authenticated;

grant insert (
  provider_id, opportunity_id, contact_id, title, due_at, status,
  priority, assigned_to, completed_at, notes
) on public.next_actions to authenticated;
grant update (
  opportunity_id, contact_id, title, due_at, status, priority,
  assigned_to, completed_at, notes
) on public.next_actions to authenticated;

grant update (
  customer_since, contract_start_date, contract_end_date, renewal_date,
  onboarding_state, status, mrr, arr, contracted_beds, owner_id, notes
) on public.customer_relationships to authenticated;

grant insert (
  customer_relationship_id, facility_id, onboarding_state, status,
  contracted_beds, live_beds, contract_start_date, go_live_date,
  ended_at, notes
) on public.customer_facilities to authenticated;
grant update (
  customer_relationship_id, facility_id, onboarding_state, status,
  contracted_beds, live_beds, contract_start_date, go_live_date,
  ended_at, notes
) on public.customer_facilities to authenticated;

grant update (display_name) on public.profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;

commit;

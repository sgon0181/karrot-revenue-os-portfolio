begin;

-- Commercial records may be genuine operating history or deliberately simulated
-- workflow data. Keep the distinction structural so sandbox exercises cannot be
-- mistaken for real commercial evidence.
alter table public.contacts
  add column record_mode text not null default 'real'
  check (record_mode in ('real', 'sandbox'));
alter table public.opportunities
  add column record_mode text not null default 'real'
  check (record_mode in ('real', 'sandbox'));
alter table public.opportunities
  add column problem_statement text,
  add column why_now text,
  add column champion_notes text,
  add column decision_process text,
  add column blockers text;
alter table public.activities
  add column record_mode text not null default 'real'
  check (record_mode in ('real', 'sandbox'));
alter table public.next_actions
  add column record_mode text not null default 'real'
  check (record_mode in ('real', 'sandbox'));
alter table public.customer_relationships
  add column record_mode text not null default 'real'
  check (record_mode in ('real', 'sandbox'));

alter table public.customer_relationships
  drop constraint if exists customer_relationships_provider_id_key;
alter table public.customer_relationships
  add constraint customer_relationships_provider_mode_key unique (provider_id, record_mode);

create or replace function private.validate_commercial_record_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_mode text;
begin
  if tg_table_name = 'opportunities' then
    if new.primary_contact_id is not null then
      select c.record_mode into linked_mode
      from public.contacts c
      where c.id = new.primary_contact_id;

      if linked_mode is not null and new.record_mode <> linked_mode then
        raise exception 'Opportunity and primary contact must use the same record mode';
      end if;
    end if;
  elsif tg_table_name = 'activities' then
    if new.opportunity_id is not null then
      select o.record_mode into linked_mode
      from public.opportunities o
      where o.id = new.opportunity_id;

      if linked_mode is not null and new.record_mode <> linked_mode then
        raise exception 'Commercial child records must use the opportunity record mode';
      end if;
    end if;
    if new.contact_id is not null then
      select c.record_mode into linked_mode
      from public.contacts c
      where c.id = new.contact_id;

      if linked_mode is not null and new.record_mode <> linked_mode then
        raise exception 'Activity and contact must use the same record mode';
      end if;
    end if;
  elsif tg_table_name = 'next_actions' then
    if new.opportunity_id is not null then
      select o.record_mode into linked_mode
      from public.opportunities o
      where o.id = new.opportunity_id;

      if linked_mode is not null and new.record_mode <> linked_mode then
        raise exception 'Commercial child records must use the opportunity record mode';
      end if;
    end if;
    if new.contact_id is not null then
      select c.record_mode into linked_mode
      from public.contacts c
      where c.id = new.contact_id;

      if linked_mode is not null and new.record_mode <> linked_mode then
        raise exception 'Next action and contact must use the same record mode';
      end if;
    end if;
  elsif tg_table_name = 'customer_relationships' and new.originating_opportunity_id is not null then
    select o.record_mode into linked_mode
    from public.opportunities o
    where o.id = new.originating_opportunity_id;

    if linked_mode is not null and new.record_mode <> linked_mode then
      raise exception 'Customer relationship must use the originating opportunity record mode';
    end if;
  end if;

  return new;
end;
$$;

create trigger opportunities_validate_record_mode
before insert or update of primary_contact_id, record_mode on public.opportunities
for each row execute function private.validate_commercial_record_mode();

create trigger activities_validate_record_mode
before insert or update of opportunity_id, contact_id, record_mode on public.activities
for each row execute function private.validate_commercial_record_mode();

create trigger next_actions_validate_record_mode
before insert or update of opportunity_id, contact_id, record_mode on public.next_actions
for each row execute function private.validate_commercial_record_mode();

create trigger customer_relationships_validate_record_mode
before insert or update of originating_opportunity_id, record_mode on public.customer_relationships
for each row execute function private.validate_commercial_record_mode();

create or replace function private.prevent_commercial_record_mode_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.record_mode is distinct from old.record_mode then
    raise exception 'Commercial record mode cannot change after creation';
  end if;
  return new;
end;
$$;

create trigger contacts_prevent_record_mode_change
before update of record_mode on public.contacts
for each row execute function private.prevent_commercial_record_mode_change();

create trigger opportunities_prevent_record_mode_change
before update of record_mode on public.opportunities
for each row execute function private.prevent_commercial_record_mode_change();

create trigger activities_prevent_record_mode_change
before update of record_mode on public.activities
for each row execute function private.prevent_commercial_record_mode_change();

create trigger next_actions_prevent_record_mode_change
before update of record_mode on public.next_actions
for each row execute function private.prevent_commercial_record_mode_change();

create trigger customer_relationships_prevent_record_mode_change
before update of record_mode on public.customer_relationships
for each row execute function private.prevent_commercial_record_mode_change();

create or replace function private.create_customer_on_win()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stage_outcome text;
begin
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;

  select outcome into stage_outcome
  from public.pipeline_stages
  where id = new.stage_id;

  if stage_outcome = 'won' then
    insert into public.customer_relationships (
      provider_id,
      originating_opportunity_id,
      customer_since,
      onboarding_state,
      status,
      owner_id,
      record_mode
    ) values (
      new.provider_id,
      new.id,
      coalesce(new.closed_won_at, now())::date,
      'not_started',
      'active',
      new.owner_id,
      new.record_mode
    )
    on conflict (provider_id, record_mode) do update set
      status = 'active',
      customer_since = coalesce(public.customer_relationships.customer_since, excluded.customer_since),
      originating_opportunity_id = coalesce(
        public.customer_relationships.originating_opportunity_id,
        excluded.originating_opportunity_id
      ),
      owner_id = coalesce(public.customer_relationships.owner_id, excluded.owner_id),
      updated_at = now();
  end if;
  return new;
end;
$$;

create or replace view public.v_provider_overview
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
  next_action.due_at as next_action_due_at,
  current_activity.record_mode as current_record_mode,
  customer.record_mode as customer_record_mode
from public.providers p
left join lateral (
  select count(*) as facility_count
  from public.facilities f0
  where f0.provider_id = p.id and f0.archived_at is null
) f on true
left join lateral (
  select count(*) as contact_count
  from public.contacts c0
  where c0.provider_id = p.id and c0.record_mode = 'real'
) c on true
left join lateral (
  select count(*) as open_opportunity_count
  from public.opportunities o0
  join public.pipeline_stages ps0 on ps0.id = o0.stage_id
  where o0.provider_id = p.id and ps0.outcome is null and o0.record_mode = 'real'
) o on true
left join lateral (
  select ps1.name as stage_name, o1.record_mode
  from public.opportunities o1
  join public.pipeline_stages ps1 on ps1.id = o1.stage_id
  where o1.provider_id = p.id
  order by (o1.record_mode = 'real') desc, o1.updated_at desc
  limit 1
) current_activity on true
left join lateral (
  select cr.status, cr.record_mode
  from public.customer_relationships cr
  where cr.provider_id = p.id
  order by (cr.record_mode = 'real') desc, cr.updated_at desc
  limit 1
) customer on true
left join lateral (
  select a.occurred_at
  from public.activities a
  where a.provider_id = p.id and a.record_mode = 'real'
  order by a.occurred_at desc
  limit 1
) latest_activity on true
left join lateral (
  select na.title, na.due_at
  from public.next_actions na
  where na.provider_id = p.id and na.status = 'open' and na.record_mode = 'real'
  order by na.due_at asc nulls last, na.created_at asc
  limit 1
) next_action on true
where p.archived_at is null;

create or replace view public.v_pipeline_board
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
  coalesce(next_action.due_at < now(), false) as next_action_overdue,
  o.record_mode,
  o.blockers
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

create or replace view public.v_customer_overview
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
  cr.updated_at,
  cr.originating_opportunity_id,
  cr.record_mode
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

create or replace view public.v_opportunities_by_stage
with (security_invoker = true)
as
select
  ps.id as stage_id,
  ps.code,
  ps.name,
  ps.position,
  ps.color,
  count(o.id) filter (where o.record_mode = 'real')::bigint as opportunity_count,
  coalesce(sum(o.estimated_value) filter (where o.record_mode = 'real'), 0)::numeric as estimated_value,
  count(o.id) filter (where o.record_mode = 'sandbox')::bigint as sandbox_opportunity_count
from public.pipeline_stages ps
left join public.opportunities o on o.stage_id = ps.id
where ps.is_active and ps.outcome is null
group by ps.id, ps.code, ps.name, ps.position, ps.color;

create or replace view public.v_dashboard_metrics
with (security_invoker = true)
as
select
  (select count(*) from public.providers where archived_at is null)::bigint as nsw_providers,
  (select count(*) from public.facilities where archived_at is null and state = 'NSW')::bigint as nsw_facilities,
  (select count(*) from public.contacts where record_mode = 'real')::bigint as contacts,
  (
    select count(*)
    from public.opportunities o
    join public.pipeline_stages ps on ps.id = o.stage_id
    where ps.outcome is null and o.record_mode = 'real'
  )::bigint as active_opportunities,
  (select count(*) from public.next_actions where status = 'open' and due_at is not null and record_mode = 'real')::bigint as actions_due,
  (select count(*) from public.next_actions where status = 'open' and due_at < now() and record_mode = 'real')::bigint as overdue_actions,
  (select count(*) from public.customer_relationships where status = 'active' and record_mode = 'real')::bigint as active_customers,
  (
    select count(*)
    from public.customer_facilities cf
    join public.customer_relationships cr on cr.id = cf.customer_relationship_id
    where cf.status = 'live' and cr.record_mode = 'real'
  )::bigint as facilities_live,
  coalesce((
    select sum(cf.live_beds)
    from public.customer_facilities cf
    join public.customer_relationships cr on cr.id = cf.customer_relationship_id
    where cf.status = 'live' and cr.record_mode = 'real'
  ), 0)::bigint as beds_live,
  (select sum(mrr) from public.customer_relationships where status = 'active' and record_mode = 'real')::numeric as mrr,
  (select sum(arr) from public.customer_relationships where status = 'active' and record_mode = 'real')::numeric as arr,
  (
    select count(*)
    from public.opportunities o
    join public.pipeline_stages ps on ps.id = o.stage_id
    where ps.outcome is null and o.record_mode = 'sandbox'
  )::bigint as sandbox_opportunities,
  (select count(*) from public.next_actions where status = 'open' and record_mode = 'sandbox')::bigint as sandbox_open_actions,
  (select count(*) from public.customer_relationships where record_mode = 'sandbox')::bigint as sandbox_customers;

create view public.v_global_search
with (security_invoker = true)
as
select
  'provider'::text as object_type,
  p.id as object_id,
  p.id as provider_id,
  p.business_name as title,
  concat_ws(' · ', p.entity_name, 'ABN ' || p.abn) as subtitle,
  null::text as location,
  null::text as record_mode,
  lower(concat_ws(' ', p.business_name, p.entity_name, p.abn)) as search_text
from public.providers p
where p.archived_at is null
union all
select
  'facility',
  f.id,
  f.provider_id,
  f.name,
  concat_ws(' · ', p.business_name, 'Site ' || f.acqsc_site_id),
  f.full_address,
  null,
  lower(concat_ws(' ', f.name, f.street, f.suburb, f.postcode, f.full_address, f.acqsc_site_id, p.business_name, p.entity_name, p.abn))
from public.facilities f
join public.providers p on p.id = f.provider_id
where f.archived_at is null and p.archived_at is null
union all
select
  'contact',
  c.id,
  c.provider_id,
  c.full_name,
  concat_ws(' · ', c.title, p.business_name),
  null,
  c.record_mode,
  lower(concat_ws(' ', c.full_name, c.title, c.role_category, c.email, p.business_name, p.entity_name, p.abn))
from public.contacts c
join public.providers p on p.id = c.provider_id
union all
select
  'opportunity',
  o.id,
  o.provider_id,
  o.name,
  concat_ws(' · ', p.business_name, ps.name),
  null,
  o.record_mode,
  lower(concat_ws(' ', o.name, p.business_name, p.entity_name, p.abn, ps.name))
from public.opportunities o
join public.providers p on p.id = o.provider_id
join public.pipeline_stages ps on ps.id = o.stage_id
union all
select
  'customer',
  cr.id,
  cr.provider_id,
  p.business_name,
  concat_ws(' · ', 'Customer', cr.status, cr.onboarding_state),
  null,
  cr.record_mode,
  lower(concat_ws(' ', p.business_name, p.entity_name, p.abn, cr.status, cr.onboarding_state))
from public.customer_relationships cr
join public.providers p on p.id = cr.provider_id;

create or replace function public.reset_sandbox_commercial_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_count integer;
  activity_count integer;
  customer_count integer;
  opportunity_count integer;
  contact_count integer;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  ) then
    raise exception 'Owner access required';
  end if;

  delete from public.next_actions where record_mode = 'sandbox';
  get diagnostics action_count = row_count;
  delete from public.activities where record_mode = 'sandbox';
  get diagnostics activity_count = row_count;
  delete from public.customer_relationships where record_mode = 'sandbox';
  get diagnostics customer_count = row_count;
  delete from public.opportunities where record_mode = 'sandbox';
  get diagnostics opportunity_count = row_count;
  delete from public.contacts where record_mode = 'sandbox';
  get diagnostics contact_count = row_count;

  return jsonb_build_object(
    'next_actions', action_count,
    'activities', activity_count,
    'customers', customer_count,
    'opportunities', opportunity_count,
    'contacts', contact_count
  );
end;
$$;

revoke all on function public.reset_sandbox_commercial_data() from public, anon;
grant execute on function public.reset_sandbox_commercial_data() to authenticated;

grant select on public.v_global_search to authenticated;
grant insert (record_mode) on public.contacts to authenticated;
grant insert (record_mode) on public.opportunities to authenticated;
grant insert (problem_statement, why_now, champion_notes, decision_process, blockers)
on public.opportunities to authenticated;
grant update (problem_statement, why_now, champion_notes, decision_process, blockers)
on public.opportunities to authenticated;
grant insert (record_mode) on public.activities to authenticated;
grant insert (record_mode) on public.next_actions to authenticated;

commit;

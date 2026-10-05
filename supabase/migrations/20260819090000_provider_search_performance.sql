begin;

-- Replace per-provider lateral scans with one aggregate pass per commercial
-- table, and expose facility identity/location terms to the provider ledger.
create or replace view public.v_provider_overview
with (security_invoker = true)
as
with facility_summary as (
  select
    f.provider_id,
    count(*)::bigint as facility_count,
    string_agg(
      lower(concat_ws(' ', f.name, f.street, f.suburb, f.postcode, f.full_address, f.acqsc_site_id)),
      ' '
    ) as facility_search_text
  from public.facilities f
  where f.archived_at is null
  group by f.provider_id
), contact_summary as (
  select c.provider_id, count(*)::bigint as contact_count
  from public.contacts c
  where c.record_mode = 'real'
  group by c.provider_id
), opportunity_summary as (
  select o.provider_id, count(*)::bigint as open_opportunity_count
  from public.opportunities o
  join public.pipeline_stages ps on ps.id = o.stage_id
  where o.record_mode = 'real' and ps.outcome is null
  group by o.provider_id
), current_activity as (
  select distinct on (o.provider_id)
    o.provider_id,
    ps.name as stage_name,
    o.record_mode
  from public.opportunities o
  join public.pipeline_stages ps on ps.id = o.stage_id
  order by o.provider_id, (o.record_mode = 'real') desc, o.updated_at desc, o.id
), current_customer as (
  select distinct on (cr.provider_id)
    cr.provider_id,
    cr.status,
    cr.record_mode
  from public.customer_relationships cr
  order by cr.provider_id, (cr.record_mode = 'real') desc, cr.updated_at desc, cr.id
), latest_activity as (
  select a.provider_id, max(a.occurred_at) as occurred_at
  from public.activities a
  where a.record_mode = 'real'
  group by a.provider_id
), next_action as (
  select distinct on (na.provider_id)
    na.provider_id,
    na.title,
    na.due_at
  from public.next_actions na
  where na.status = 'open' and na.record_mode = 'real'
  order by na.provider_id, na.due_at asc nulls last, na.created_at asc, na.id
)
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
  activity.stage_name as current_commercial_activity,
  customer.status as customer_status,
  latest.occurred_at as last_activity_at,
  action.title as next_action,
  action.due_at as next_action_due_at,
  activity.record_mode as current_record_mode,
  customer.record_mode as customer_record_mode,
  lower(concat_ws(
    ' ',
    p.business_name,
    p.entity_name,
    p.abn,
    coalesce(f.facility_search_text, '')
  )) as search_text
from public.providers p
left join facility_summary f on f.provider_id = p.id
left join contact_summary c on c.provider_id = p.id
left join opportunity_summary o on o.provider_id = p.id
left join current_activity activity on activity.provider_id = p.id
left join current_customer customer on customer.provider_id = p.id
left join latest_activity latest on latest.provider_id = p.id
left join next_action action on action.provider_id = p.id
where p.archived_at is null;

commit;

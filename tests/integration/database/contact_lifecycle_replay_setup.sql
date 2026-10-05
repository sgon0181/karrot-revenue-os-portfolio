\set ON_ERROR_STOP on

insert into public.contacts (
  provider_id, full_name, currentness_status, last_verified_at,
  last_observed_at, record_mode
)
select id, 'Lifecycle Replay Sentinel', 'changed_role', now(), null, 'real'
from public.providers
where not is_sample
order by created_at
limit 1;

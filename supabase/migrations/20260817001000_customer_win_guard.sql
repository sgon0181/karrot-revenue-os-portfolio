begin;

-- UPDATE OF fires when stage_id appears in SET, even if its value did not
-- change. Guard the won transition so a routine save cannot reactivate a
-- customer relationship that was intentionally paused or churned.
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
      owner_id
    ) values (
      new.provider_id,
      new.id,
      coalesce(new.closed_won_at, now())::date,
      'not_started',
      'active',
      new.owner_id
    )
    on conflict (provider_id) do update set
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

commit;

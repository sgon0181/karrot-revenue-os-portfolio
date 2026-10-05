\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-data-health@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'editor-data-health@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'viewer-data-health@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.profiles set role = 'owner' where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'editor' where id = '10000000-0000-4000-8000-000000000002';
update public.profiles set role = 'viewer' where id = '10000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$
declare
  decision_id bigint;
begin
  select id into decision_id
  from public.facility_match_decisions
  where status in ('review_required', 'unmatched')
  order by id
  limit 1;

  begin
    perform public.review_facility_match(decision_id, 'reject', null, 'Viewer must not review matches');
    raise exception 'Viewer unexpectedly reviewed a facility match';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.reset_sandbox_commercial_data();
    raise exception 'Viewer unexpectedly reset sandbox commercial data';
  exception
    when raise_exception then
      if sqlerrm <> 'Owner access required' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

do $$
declare
  v_decision_id bigint;
  v_candidate_facility_id uuid;
  v_source_record_id bigint;
begin
  select decision.id, candidate.facility_id, decision.source_record_id
  into v_decision_id, v_candidate_facility_id, v_source_record_id
  from public.facility_match_decisions decision
  join public.facility_match_candidates candidate
    on candidate.decision_id = decision.id and candidate.candidate_rank = 1
  where decision.dataset_code = 'star_ratings'
    and decision.status = 'review_required'
  order by decision.id
  limit 1;

  if v_decision_id is null then raise exception 'No Star Rating review fixture is available'; end if;

  perform public.review_facility_match(
    v_decision_id,
    'confirm',
    v_candidate_facility_id,
    'Candidate identity checked against the source row'
  );

  if not exists (
    select 1 from public.star_rating_snapshots
    where source_record_id = v_source_record_id and facility_id = v_candidate_facility_id
  ) then
    raise exception 'Confirmed match did not create its attributed source snapshot';
  end if;

  if not exists (
    select 1 from public.facility_match_review_events
    where decision_id = v_decision_id
      and action = 'confirm'
      and reviewed_by = auth.uid()
      and review_note = 'Candidate identity checked against the source row'
  ) then
    raise exception 'Confirmed match did not retain reviewer attribution and note';
  end if;
end;
$$;

do $$
declare
  v_decision_id bigint;
  prior_event_count integer;
begin
  select id into v_decision_id
  from public.facility_match_decisions
  where dataset_code = 'care_minutes' and status = 'unmatched'
  order by id
  limit 1;

  if v_decision_id is null then raise exception 'No care-minutes rejection fixture is available'; end if;
  select count(*) into prior_event_count from public.facility_match_review_events where decision_id = v_decision_id;

  perform public.review_facility_match(v_decision_id, 'reject', null, 'No registered facility matches the source identity');
  perform public.review_facility_match(v_decision_id, 'reset', null, 'New evidence requires another review');

  if not exists (
    select 1 from public.facility_match_decisions
    where id = v_decision_id and status = 'review_required' and facility_id is null
  ) then
    raise exception 'Rejected observation was not returned to review';
  end if;

  if (select count(*) from public.facility_match_review_events where decision_id = v_decision_id) <> prior_event_count + 2 then
    raise exception 'Reject/reset transition did not append both audit events';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
declare
  provider_id uuid;
  real_contact_id uuid;
  sandbox_contact_id uuid;
begin
  select id into provider_id
  from public.providers
  where not is_sample
  order by abn
  limit 1;

  insert into public.contacts (provider_id, full_name, record_mode)
  values (provider_id, 'Data Health real control', 'real')
  returning id into real_contact_id;
  insert into public.contacts (provider_id, full_name, record_mode)
  values (provider_id, 'SANDBOX / DEMO data-health test', 'sandbox')
  returning id into sandbox_contact_id;

  perform public.reset_sandbox_commercial_data();

  if exists (
    select 1 from public.contacts where id = sandbox_contact_id
  ) or exists (
    select 1
    from public.contacts contact
    join public.providers provider on provider.id = contact.provider_id
    where contact.record_mode = 'sandbox'
      and not provider.is_sample
  ) then
    raise exception 'Owner sandbox reset retained non-sample sandbox contacts';
  end if;
  if not exists (
    select 1
    from public.contacts contact
    where contact.id = '5a000000-0000-4000-8000-000000000003'
      and contact.provider_id = '5a000000-0000-4000-8000-000000000001'
      and contact.full_name = 'Norman Osborn'
      and contact.record_mode = 'sandbox'
  ) then
    raise exception 'Owner sandbox reset removed the permanent sample contact';
  end if;
  if not exists (select 1 from public.contacts where id = real_contact_id and record_mode = 'real') then
    raise exception 'Owner sandbox reset removed real commercial history';
  end if;
end;
$$;

rollback;

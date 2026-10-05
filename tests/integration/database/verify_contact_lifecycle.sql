\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-contact-lifecycle@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'editor-contact-lifecycle@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'viewer-contact-lifecycle@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.profiles set role = 'owner'
where id = '20000000-0000-4000-8000-000000000001';
update public.profiles set role = 'editor'
where id = '20000000-0000-4000-8000-000000000002';
update public.profiles set role = 'viewer'
where id = '20000000-0000-4000-8000-000000000003';

do $$
begin
  if exists (
    select 1 from public.contacts
    where currentness_status is null
      or (last_verified_at is not null and last_observed_at is null)
  ) then
    raise exception 'Existing contacts were not safely backfilled';
  end if;
  if has_column_privilege(
    'authenticated', 'public.contacts', 'currentness_status', 'UPDATE'
  ) then
    raise exception 'Contact lifecycle status can be updated outside the review API';
  end if;
  if has_column_privilege('authenticated', 'public.contacts', 'email', 'UPDATE')
    or has_column_privilege('authenticated', 'public.contacts', 'title', 'UPDATE')
    or has_table_privilege('authenticated', 'public.contacts', 'UPDATE') then
    raise exception 'Authenticated clients can bypass contact review with direct updates';
  end if;
  if has_table_privilege('service_role', 'public.contacts', 'UPDATE') then
    raise exception 'Service role retains a direct durable-contact update grant';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.propose_contact_change(uuid,text,jsonb,timestamp with time zone,text,text,uuid,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.propose_contact_change(uuid,text,jsonb,timestamp with time zone,text,text,uuid,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.review_contact_change(uuid,text,text)', 'EXECUTE'
  ) or not has_function_privilege(
    'service_role', 'public.review_contact_change(uuid,text,text)', 'EXECUTE'
  ) then
    raise exception 'Contact lifecycle RPC grants do not match the admin contract';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);

do $$
declare
  v_provider_id uuid;
  v_facility_a uuid;
  v_facility_b uuid;
  v_contact_id uuid;
  v_proposal_id uuid;
  v_rejected_id uuid;
  v_first_concurrent_id uuid;
  v_stale_concurrent_id uuid;
  v_sandbox_contact_id uuid;
begin
  select p.id into v_provider_id
  from public.providers p
  where (select count(*) from public.facilities f where f.provider_id = p.id) >= 2
  order by p.created_at
  limit 1;
  select f.id into v_facility_a
  from public.facilities f where f.provider_id = v_provider_id
  order by f.created_at limit 1;
  select f.id into v_facility_b
  from public.facilities f where f.provider_id = v_provider_id and f.id <> v_facility_a
  order by f.created_at limit 1;

  insert into public.contacts (
    provider_id, facility_id, full_name, title, email, last_verified_at,
    record_mode
  ) values (
    v_provider_id, v_facility_a, 'Durable Contact', 'Director of Nursing',
    'old-role@example.invalid', now() - interval '90 days', 'real'
  ) returning id into v_contact_id;

  -- New contacts remain creatable, but even editors have no direct update path
  -- for existing real contact details.
  begin
    update public.contacts
    set email = 'destructive-overwrite@example.invalid'
    where id = v_contact_id;
    raise exception 'Editor directly overwrote a durable contact';
  exception
    when insufficient_privilege then null;
  end;
  if not exists (
    select 1 from public.contacts
    where id = v_contact_id and email = 'old-role@example.invalid'
  ) then
    raise exception 'Failed direct edit changed durable contact details';
  end if;

  insert into public.contacts (
    provider_id, facility_id, full_name, title, record_mode
  ) values (
    v_provider_id, v_facility_a, 'Editable Sandbox Contact',
    'Sandbox role', 'sandbox'
  ) returning id into v_sandbox_contact_id;
  perform public.update_sandbox_contact(
    v_sandbox_contact_id,
    v_provider_id,
    jsonb_build_object('title', 'Updated sandbox role')
  );
  if not exists (
    select 1 from public.contacts
    where id = v_sandbox_contact_id and title = 'Updated sandbox role'
  ) then
    raise exception 'Guarded sandbox contact update did not work';
  end if;

  v_proposal_id := public.propose_contact_change(
    v_contact_id,
    'change',
    jsonb_build_object(
      'facility_id', v_facility_b,
      'title', 'Regional Clinical Lead',
      'email', 'new-role@example.invalid',
      'currentness_status', 'changed_role'
    ),
    now() - interval '1 day',
    'professional_profile',
    'https://example.invalid/evidence/contact-role',
    null,
    'Public evidence indicates a role and facility change'
  );

  if not exists (
    select 1 from public.contacts
    where id = v_contact_id
      and title = 'Director of Nursing'
      and email = 'old-role@example.invalid'
      and facility_id = v_facility_a
  ) then
    raise exception 'Pending proposal silently changed the contact';
  end if;

  if not exists (
    select 1 from public.contact_verification_events
    where proposal_id = v_proposal_id
      and event_type = 'proposed'
      and previous_values ->> 'email' = 'old-role@example.invalid'
  ) then
    raise exception 'Proposal did not retain the pre-change contact details';
  end if;

  perform public.review_contact_change(v_proposal_id, 'approve', 'Confirmed by editor');

  if not exists (
    select 1 from public.contacts
    where id = v_contact_id
      and title = 'Regional Clinical Lead'
      and email = 'new-role@example.invalid'
      and facility_id = v_facility_b
      and currentness_status = 'changed_role'
      and last_verified_at > now() - interval '1 minute'
  ) then
    raise exception 'Approved contact change was not applied to the stable identity';
  end if;

  if not exists (
    select 1 from public.contact_verification_events
    where proposal_id = v_proposal_id
      and event_type = 'approved'
      and previous_values ->> 'title' = 'Director of Nursing'
      and proposed_values ->> 'title' = 'Regional Clinical Lead'
      and resulting_values ->> 'email' = 'new-role@example.invalid'
      and performed_by = auth.uid()
  ) then
    raise exception 'Approval event did not preserve before/proposed/resulting values';
  end if;

  v_rejected_id := public.propose_contact_change(
    v_contact_id,
    'change',
    jsonb_build_object('phone', '+61 2 9999 9999'),
    now(),
    'official_provider',
    'https://example.invalid/evidence/contact-phone',
    null,
    'Candidate phone change'
  );
  perform public.review_contact_change(v_rejected_id, 'reject', 'Could not verify');

  if exists (
    select 1 from public.contacts
    where id = v_contact_id and phone = '+61 2 9999 9999'
  ) then
    raise exception 'Rejected contact change was applied';
  end if;
  if not exists (
    select 1 from public.contact_change_proposals
    where id = v_rejected_id and status = 'rejected' and reviewed_by = auth.uid()
  ) then
    raise exception 'Rejected proposal did not retain attributed review history';
  end if;

  v_first_concurrent_id := public.propose_contact_change(
    v_contact_id, 'change', jsonb_build_object('phone', '+61 2 9000 0001'),
    now(), 'official_provider',
    'https://example.invalid/evidence/first-concurrent', null,
    'First concurrent proposal'
  );
  v_stale_concurrent_id := public.propose_contact_change(
    v_contact_id, 'change', jsonb_build_object('title', 'Stale title'),
    now(), 'official_provider',
    'https://example.invalid/evidence/stale-concurrent', null,
    'Second concurrent proposal'
  );
  perform public.review_contact_change(
    v_first_concurrent_id, 'approve', 'Approve the first proposal'
  );
  begin
    perform public.review_contact_change(
      v_stale_concurrent_id, 'approve', 'Must not overwrite newer values'
    );
    raise exception 'Stale proposal silently overwrote a newer contact state';
  exception
    when raise_exception then
      if sqlerrm not like 'Contact changed since this proposal%' then raise; end if;
  end;
  perform public.review_contact_change(
    v_stale_concurrent_id, 'reject', 'Superseded by newer contact state'
  );
end;
$$;

-- A viewer can inspect lifecycle evidence but cannot propose or review changes.
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);

do $$
declare
  v_contact_id uuid;
  v_proposal_id uuid;
begin
  select id into v_contact_id from public.contacts where full_name = 'Durable Contact';
  select proposal.id into v_proposal_id
  from public.contact_change_proposals proposal
  where proposal.contact_id = v_contact_id
  order by proposed_at limit 1;

  if not exists (
    select 1 from public.contact_verification_events
    where contact_verification_events.contact_id = v_contact_id
  ) then
    raise exception 'Viewer could not read contact lifecycle history';
  end if;

  begin
    perform public.propose_contact_change(v_contact_id, 'verification');
    raise exception 'Viewer unexpectedly proposed a contact verification';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.review_contact_change(v_proposal_id, 'reject', 'Viewer attempt');
    raise exception 'Viewer unexpectedly reviewed a contact proposal';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.contact_change_proposals (
      contact_id, proposal_kind, proposed_changes, previous_values, proposed_by
    ) values (v_contact_id, 'verification', '{}'::jsonb, '{}'::jsonb, auth.uid());
    raise exception 'Viewer unexpectedly inserted a proposal directly';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Owners have the same human review path as editors.
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_contact_id uuid;
  v_proposal_id uuid;
begin
  select id into v_contact_id from public.contacts where full_name = 'Durable Contact';
  v_proposal_id := public.propose_contact_change(
    v_contact_id, 'verification', '{}'::jsonb, now(),
    'official_provider', 'https://example.invalid/evidence/current-role', null,
    'Owner reverified the current role'
  );
  perform public.review_contact_change(v_proposal_id, 'approve', 'Still current');

  if not exists (
    select 1 from public.contacts
    where id = v_contact_id and currentness_status = 'current'
  ) then
    raise exception 'Approved owner verification did not mark the contact current';
  end if;

  begin
    delete from public.contacts where id = v_contact_id;
    raise exception 'Owner unexpectedly deleted a durable contact';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

-- Even service-role access cannot rewrite a real contact or its evidence, or
-- delete durable identity history.
set local role service_role;

do $$
declare
  v_contact_id uuid;
  v_event_id bigint;
begin
  select id into v_contact_id from public.contacts where full_name = 'Durable Contact';
  select id into v_event_id
  from public.contact_verification_events
  where contact_verification_events.contact_id = v_contact_id
  order by occurred_at limit 1;

  begin
    perform set_config('app.contact_review_approved', 'on', true);
    update public.contacts
    set email = 'service-overwrite@example.invalid'
    where id = v_contact_id;
    raise exception 'Service role forged the old setting and overwrote a durable contact';
  exception
    when insufficient_privilege then null;
  end;
  if not exists (
    select 1 from public.contacts
    where id = v_contact_id and email = 'new-role@example.invalid'
  ) then
    raise exception 'Forged setting changed durable contact details';
  end if;

  begin
    update public.contact_verification_events set note = 'rewritten' where id = v_event_id;
    raise exception 'Append-only contact event was updated';
  exception
    when raise_exception then
      if sqlerrm not like '%append-only%' then raise; end if;
  end;

  begin
    delete from public.contact_verification_events where id = v_event_id;
    raise exception 'Append-only contact event was deleted';
  exception
    when raise_exception then
      if sqlerrm not like '%append-only%' then raise; end if;
  end;

  begin
    delete from public.contacts where id = v_contact_id;
    raise exception 'Durable real contact was deleted';
  exception
    when raise_exception then
      if sqlerrm not like 'Real contacts are retained%' then raise; end if;
  end;
end;
$$;

rollback;

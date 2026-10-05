\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'editor-test@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'viewer-test@karrot.invalid', '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.profiles set role = 'editor' where id = '10000000-0000-4000-8000-000000000002';
update public.profiles set role = 'viewer' where id = '10000000-0000-4000-8000-000000000003';

do $$
declare
  relation_name text := 'field_visits';
begin
  if has_table_privilege('anon', 'public.' || relation_name, 'SELECT')
    or has_table_privilege('authenticated', 'public.' || relation_name, 'TRUNCATE') then
    raise exception 'Unsafe field planner ACL';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

do $$
declare
  facility_a uuid;
  facility_b uuid;
  provider_a uuid;
  provider_b uuid;
  contact_a uuid;
  contact_b uuid;
  visit_id uuid;
begin
  select id, provider_id into facility_a, provider_a
  from public.facilities
  where archived_at is null and not is_sample
  order by acqsc_site_id
  limit 1;

  select id, provider_id into facility_b, provider_b
  from public.facilities
  where archived_at is null and provider_id <> provider_a and not is_sample
  order by acqsc_site_id
  limit 1;

  insert into public.contacts (provider_id, facility_id, full_name, record_mode)
  values (provider_a, facility_a, 'Planner Contact A', 'real')
  returning id into contact_a;

  insert into public.contacts (provider_id, facility_id, full_name, record_mode)
  values (provider_b, facility_b, 'Planner Contact B', 'real')
  returning id into contact_b;

  insert into public.field_visits (
    facility_id, contact_id, starts_at, ends_at, status, notes
  ) values (
    facility_a, contact_a, '2026-08-25 10:00:00+10', '2026-08-25 11:00:00+10',
    'confirmed', 'Integration planner visit'
  ) returning id into visit_id;

  if not exists (
    select 1 from public.field_visits
    where id = visit_id and created_by = auth.uid() and status = 'confirmed'
  ) then
    raise exception 'Field visit was not created with authenticated attribution';
  end if;

  update public.field_visits
  set starts_at = '2026-08-25 14:00:00+10', ends_at = '2026-08-25 15:00:00+10'
  where id = visit_id;

  if not exists (
    select 1 from public.field_visits
    where id = visit_id and starts_at = '2026-08-25 14:00:00+10'::timestamptz
  ) then
    raise exception 'Field visit was not rescheduled';
  end if;

  begin
    update public.field_visits set contact_id = contact_b where id = visit_id;
    raise exception 'Cross-provider visit contact validation did not fire';
  exception
    when raise_exception then
      if sqlerrm not like 'Visit contact must belong%' then
        raise;
      end if;
  end;

  begin
    update public.field_visits set ends_at = starts_at where id = visit_id;
    raise exception 'Invalid visit duration was accepted';
  exception
    when check_violation then null;
  end;

  delete from public.field_visits where id = visit_id;
  if exists (select 1 from public.field_visits where id = visit_id) then
    raise exception 'Editor could not remove the field visit';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$
declare
  facility_id uuid;
begin
  select id into facility_id from public.facilities where archived_at is null and not is_sample limit 1;
  begin
    insert into public.field_visits (facility_id, starts_at, ends_at)
    values (facility_id, now(), now() + interval '1 hour');
    raise exception 'Viewer created a field visit';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;

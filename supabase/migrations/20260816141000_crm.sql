begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  facility_id uuid references public.facilities(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  title text,
  email text,
  phone text,
  professional_profile_url text,
  role_category text,
  relationship_status text,
  source_type text,
  source_url text,
  last_verified_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function private.set_updated_at();

create or replace function private.set_authenticated_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

create trigger contacts_set_authenticated_creator
before insert on public.contacts
for each row execute function private.set_authenticated_creator();

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]+$'),
  name text not null,
  position integer not null unique check (position > 0),
  color text not null default '#64748B',
  outcome text check (outcome in ('won', 'lost')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pipeline_stages_set_updated_at
before update on public.pipeline_stages
for each row execute function private.set_updated_at();

insert into public.pipeline_stages (id, code, name, position, color, outcome)
values
  ('00000000-0000-4000-8000-000000000001', 'IDENTIFIED', 'Identified', 1, '#94A3B8', null),
  ('00000000-0000-4000-8000-000000000002', 'RESEARCHED', 'Researched', 2, '#64748B', null),
  ('00000000-0000-4000-8000-000000000003', 'CONTACT_READY', 'Contact ready', 3, '#0EA5E9', null),
  ('00000000-0000-4000-8000-000000000004', 'CONTACTED', 'Contacted', 4, '#0284C7', null),
  ('00000000-0000-4000-8000-000000000005', 'ENGAGED', 'Engaged', 5, '#6366F1', null),
  ('00000000-0000-4000-8000-000000000006', 'DISCOVERY', 'Discovery', 6, '#8B5CF6', null),
  ('00000000-0000-4000-8000-000000000007', 'QUALIFIED', 'Qualified', 7, '#A855F7', null),
  ('00000000-0000-4000-8000-000000000008', 'EVALUATION', 'Evaluation', 8, '#D946EF', null),
  ('00000000-0000-4000-8000-000000000009', 'PILOT_OR_PROPOSAL', 'Pilot or proposal', 9, '#F59E0B', null),
  ('00000000-0000-4000-8000-000000000010', 'COMMERCIAL', 'Commercial', 10, '#F97316', null),
  ('00000000-0000-4000-8000-000000000011', 'CLOSED_WON', 'Closed won', 11, '#22C55E', 'won'),
  ('00000000-0000-4000-8000-000000000012', 'CLOSED_LOST', 'Closed lost', 12, '#EF4444', 'lost')
on conflict (code) do nothing;

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  stage_entered_at timestamptz not null default now(),
  primary_contact_id uuid references public.contacts(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  notes text,
  estimated_value numeric(14, 2) check (estimated_value >= 0),
  currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  estimated_beds integer check (estimated_beds >= 0),
  expected_close_date date,
  closed_won_at timestamptz,
  closed_lost_at timestamptz,
  closed_lost_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (closed_won_at is not null and closed_lost_at is not null))
);

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function private.set_updated_at();

create trigger opportunities_set_authenticated_creator
before insert on public.opportunities
for each row execute function private.set_authenticated_creator();

create table public.opportunity_stage_history (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages(id) on delete restrict,
  to_stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  entered_at timestamptz not null,
  exited_at timestamptz,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (exited_at is null or exited_at >= entered_at)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  facility_id uuid references public.facilities(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  activity_type text not null,
  subject text not null,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create trigger activities_set_authenticated_creator
before insert on public.activities
for each row execute function private.set_authenticated_creator();

create table public.next_actions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  )
);

create trigger next_actions_set_updated_at
before update on public.next_actions
for each row execute function private.set_updated_at();

create trigger next_actions_set_authenticated_creator
before insert on public.next_actions
for each row execute function private.set_authenticated_creator();

create table public.customer_relationships (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null unique references public.providers(id) on delete restrict,
  originating_opportunity_id uuid references public.opportunities(id) on delete set null,
  customer_since date,
  contract_start_date date,
  contract_end_date date,
  renewal_date date,
  onboarding_state text,
  status text not null default 'active' check (status in ('active', 'inactive', 'churned')),
  mrr numeric(14, 2) check (mrr >= 0),
  arr numeric(14, 2) check (arr >= 0),
  contracted_beds integer check (contracted_beds >= 0),
  owner_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    contract_end_date is null
    or contract_start_date is null
    or contract_end_date >= contract_start_date
  )
);

create trigger customer_relationships_set_updated_at
before update on public.customer_relationships
for each row execute function private.set_updated_at();

create table public.customer_facilities (
  id uuid primary key default gen_random_uuid(),
  customer_relationship_id uuid not null
    references public.customer_relationships(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  onboarding_state text,
  status text not null default 'contracted'
    check (status in ('contracted', 'onboarding', 'live', 'paused', 'ended')),
  contracted_beds integer check (contracted_beds >= 0),
  live_beds integer check (live_beds >= 0),
  contract_start_date date,
  go_live_date date,
  ended_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_relationship_id, facility_id)
);

create trigger customer_facilities_set_updated_at
before update on public.customer_facilities
for each row execute function private.set_updated_at();

create or replace function private.validate_contact_facility_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.facility_id is not null and not exists (
    select 1 from public.facilities f
    where f.id = new.facility_id and f.provider_id = new.provider_id
  ) then
    raise exception 'Contact facility must belong to the contact provider';
  end if;
  return new;
end;
$$;

create trigger contacts_validate_provider_links
before insert or update of provider_id, facility_id on public.contacts
for each row execute function private.validate_contact_facility_provider();

create or replace function private.validate_opportunity_contact_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_contact_id is not null and not exists (
    select 1 from public.contacts c
    where c.id = new.primary_contact_id and c.provider_id = new.provider_id
  ) then
    raise exception 'Opportunity primary contact must belong to the opportunity provider';
  end if;
  return new;
end;
$$;

create trigger opportunities_validate_provider_links
before insert or update of provider_id, primary_contact_id on public.opportunities
for each row execute function private.validate_opportunity_contact_provider();

create or replace function private.validate_activity_provider_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.facility_id is not null and not exists (
    select 1 from public.facilities f
    where f.id = new.facility_id and f.provider_id = new.provider_id
  ) then
    raise exception 'Activity facility must belong to the activity provider';
  end if;
  if new.opportunity_id is not null and not exists (
    select 1 from public.opportunities o
    where o.id = new.opportunity_id and o.provider_id = new.provider_id
  ) then
    raise exception 'Activity opportunity must belong to the activity provider';
  end if;
  if new.contact_id is not null and not exists (
    select 1 from public.contacts c
    where c.id = new.contact_id and c.provider_id = new.provider_id
  ) then
    raise exception 'Activity contact must belong to the activity provider';
  end if;
  return new;
end;
$$;

create trigger activities_validate_provider_links
before insert or update of provider_id, facility_id, opportunity_id, contact_id
on public.activities
for each row execute function private.validate_activity_provider_links();

create or replace function private.validate_next_action_provider_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opportunity_id is not null and not exists (
    select 1 from public.opportunities o
    where o.id = new.opportunity_id and o.provider_id = new.provider_id
  ) then
    raise exception 'Next action opportunity must belong to the action provider';
  end if;
  if new.contact_id is not null and not exists (
    select 1 from public.contacts c
    where c.id = new.contact_id and c.provider_id = new.provider_id
  ) then
    raise exception 'Next action contact must belong to the action provider';
  end if;
  return new;
end;
$$;

create trigger next_actions_validate_provider_links
before insert or update of provider_id, opportunity_id, contact_id on public.next_actions
for each row execute function private.validate_next_action_provider_links();

create or replace function private.validate_customer_provider_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.originating_opportunity_id is not null and not exists (
    select 1 from public.opportunities o
    where o.id = new.originating_opportunity_id and o.provider_id = new.provider_id
  ) then
    raise exception 'Originating opportunity must belong to the customer provider';
  end if;
  return new;
end;
$$;

create trigger customer_relationships_validate_provider_links
before insert or update of provider_id, originating_opportunity_id
on public.customer_relationships
for each row execute function private.validate_customer_provider_links();

create or replace function private.validate_customer_facility_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.customer_relationships cr
    join public.facilities f on f.id = new.facility_id
    where cr.id = new.customer_relationship_id
      and cr.provider_id = f.provider_id
  ) then
    raise exception 'Customer facility must belong to the customer provider';
  end if;
  return new;
end;
$$;

create trigger customer_facilities_validate_provider_links
before insert or update of customer_relationship_id, facility_id
on public.customer_facilities
for each row execute function private.validate_customer_facility_provider();

create or replace function private.protect_referenced_stage_semantics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.outcome is distinct from old.outcome and exists (
    select 1 from public.opportunities o where o.stage_id = old.id
  ) then
    raise exception 'Cannot change the outcome of a pipeline stage referenced by opportunities';
  end if;
  if old.is_active and not new.is_active and old.outcome is null and exists (
    select 1 from public.opportunities o where o.stage_id = old.id
  ) then
    raise exception 'Cannot deactivate an open pipeline stage referenced by opportunities';
  end if;
  return new;
end;
$$;

create trigger pipeline_stages_protect_referenced_semantics
before update of outcome, is_active on public.pipeline_stages
for each row execute function private.protect_referenced_stage_semantics();

create or replace function private.validate_provider_reassignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider_id is not distinct from old.provider_id then
    return new;
  end if;

  if tg_table_name = 'facilities' then
    if exists (
      select 1 from public.contacts c
      where c.facility_id = new.id and c.provider_id <> new.provider_id
    ) or exists (
      select 1 from public.activities a
      where a.facility_id = new.id and a.provider_id <> new.provider_id
    ) or exists (
      select 1
      from public.customer_facilities cf
      join public.customer_relationships cr on cr.id = cf.customer_relationship_id
      where cf.facility_id = new.id and cr.provider_id <> new.provider_id
    ) then
      raise exception 'Facility provider cannot change while commercial records reference the prior provider';
    end if;
  elsif tg_table_name = 'contacts' then
    if exists (
      select 1 from public.opportunities o
      where o.primary_contact_id = new.id and o.provider_id <> new.provider_id
    ) or exists (
      select 1 from public.activities a
      where a.contact_id = new.id and a.provider_id <> new.provider_id
    ) or exists (
      select 1 from public.next_actions na
      where na.contact_id = new.id and na.provider_id <> new.provider_id
    ) then
      raise exception 'Contact provider cannot change while provider-scoped records reference it';
    end if;
  elsif tg_table_name = 'opportunities' then
    if exists (
      select 1 from public.activities a
      where a.opportunity_id = new.id and a.provider_id <> new.provider_id
    ) or exists (
      select 1 from public.next_actions na
      where na.opportunity_id = new.id and na.provider_id <> new.provider_id
    ) or exists (
      select 1 from public.customer_relationships cr
      where cr.originating_opportunity_id = new.id and cr.provider_id <> new.provider_id
    ) then
      raise exception 'Opportunity provider cannot change while provider-scoped records reference it';
    end if;
  elsif tg_table_name = 'customer_relationships' then
    if exists (
      select 1
      from public.customer_facilities cf
      join public.facilities f on f.id = cf.facility_id
      where cf.customer_relationship_id = new.id and f.provider_id <> new.provider_id
    ) then
      raise exception 'Customer provider cannot change while facilities reference it';
    end if;
  end if;

  return new;
end;
$$;

create trigger facilities_validate_provider_reassignment
before update of provider_id on public.facilities
for each row execute function private.validate_provider_reassignment();

create trigger contacts_validate_provider_reassignment
before update of provider_id on public.contacts
for each row execute function private.validate_provider_reassignment();

create trigger opportunities_validate_provider_reassignment
before update of provider_id on public.opportunities
for each row execute function private.validate_provider_reassignment();

create trigger customer_relationships_validate_provider_reassignment
before update of provider_id on public.customer_relationships
for each row execute function private.validate_provider_reassignment();

create or replace function private.prepare_opportunity_stage()
returns trigger
language plpgsql
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

  if tg_op = 'INSERT' then
    new.stage_entered_at = now();
  elsif new.stage_id is distinct from old.stage_id then
    new.stage_entered_at = now();
  end if;

  if stage_outcome = 'won' then
    if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
      new.closed_won_at = now();
    end if;
    new.closed_lost_at = null;
    new.closed_lost_reason = null;
  elsif stage_outcome = 'lost' then
    if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
      new.closed_lost_at = now();
    end if;
    new.closed_won_at = null;
  else
    new.closed_won_at = null;
    new.closed_lost_at = null;
    new.closed_lost_reason = null;
  end if;

  return new;
end;
$$;

create trigger opportunities_prepare_stage
before insert or update of stage_id on public.opportunities
for each row execute function private.prepare_opportunity_stage();

create or replace function private.record_opportunity_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.opportunity_stage_history (
      opportunity_id, from_stage_id, to_stage_id, entered_at, changed_by
    ) values (
      new.id, null, new.stage_id, new.stage_entered_at, new.created_by
    );
  elsif new.stage_id is distinct from old.stage_id then
    update public.opportunity_stage_history
    set exited_at = new.stage_entered_at
    where opportunity_id = new.id and exited_at is null;

    insert into public.opportunity_stage_history (
      opportunity_id, from_stage_id, to_stage_id, entered_at, changed_by
    ) values (
      new.id, old.stage_id, new.stage_id, new.stage_entered_at, auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger opportunities_record_stage
after insert or update of stage_id on public.opportunities
for each row execute function private.record_opportunity_stage();

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

create trigger opportunities_create_customer_on_win
after insert or update of stage_id on public.opportunities
for each row execute function private.create_customer_on_win();

create index contacts_provider_idx on public.contacts (provider_id);
create index contacts_facility_idx on public.contacts (facility_id) where facility_id is not null;
create index opportunities_provider_idx on public.opportunities (provider_id);
create index opportunities_open_stage_idx
  on public.opportunities (stage_id, expected_close_date)
  where closed_won_at is null and closed_lost_at is null;
create index activities_provider_occurred_idx on public.activities (provider_id, occurred_at desc);
create index activities_opportunity_occurred_idx
  on public.activities (opportunity_id, occurred_at desc)
  where opportunity_id is not null;
create index next_actions_open_due_idx
  on public.next_actions (due_at)
  where status = 'open';
create index customer_facilities_status_idx on public.customer_facilities (status);

commit;

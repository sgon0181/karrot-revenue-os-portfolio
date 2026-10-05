begin;

-- A contact is a durable CRM identity. Research age can prompt review, but it
-- must never remove the row or silently replace its commercial details.
alter table public.contacts
  add column if not exists currentness_status text not null default 'unverified'
    check (currentness_status in (
      'current', 'needs_review', 'changed_role',
      'left_organisation', 'unverified'
    )),
  add column if not exists last_observed_at timestamptz;

-- On an intentional replay, this migration executes as the database owner, so
-- the invoker trigger permits this state-preserving backfill.
update public.contacts
set currentness_status = case
      when currentness_status = 'unverified' and last_verified_at is not null
        then 'current'
      else currentness_status
    end,
    last_observed_at = coalesce(last_observed_at, last_verified_at)
where last_observed_at is null;

create table if not exists public.contact_change_proposals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  proposal_kind text not null check (proposal_kind in ('verification', 'change')),
  proposed_changes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(proposed_changes) = 'object'),
  previous_values jsonb not null check (jsonb_typeof(previous_values) = 'object'),
  observed_at timestamptz,
  source_type text check (source_type is null or source_type in (
    'official_provider', 'official_government', 'annual_report', 'news',
    'professional_profile', 'conference', 'other'
  )),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  intelligence_source_id uuid references public.intelligence_sources(id) on delete restrict,
  proposal_note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  proposed_by uuid not null references public.profiles(id) on delete restrict,
  proposed_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  constraint contact_change_proposals_review_attribution check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint contact_change_proposals_evidence check (
    proposal_kind = 'verification'
    or source_url is not null
    or intelligence_source_id is not null
  )
);

create table if not exists public.contact_verification_events (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  proposal_id uuid not null references public.contact_change_proposals(id) on delete restrict,
  event_type text not null check (event_type in ('proposed', 'approved', 'rejected')),
  previous_values jsonb not null check (jsonb_typeof(previous_values) = 'object'),
  proposed_values jsonb not null check (jsonb_typeof(proposed_values) = 'object'),
  resulting_values jsonb check (
    resulting_values is null or jsonb_typeof(resulting_values) = 'object'
  ),
  source_type text check (source_type is null or source_type in (
    'official_provider', 'official_government', 'annual_report', 'news',
    'professional_profile', 'conference', 'other'
  )),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  intelligence_source_id uuid references public.intelligence_sources(id) on delete restrict,
  note text,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now()
);

create index if not exists contact_change_proposals_contact_idx
  on public.contact_change_proposals(contact_id, status, proposed_at desc);
create index if not exists contact_change_proposals_pending_idx
  on public.contact_change_proposals(proposed_at desc)
  where status = 'pending';
create index if not exists contact_verification_events_contact_idx
  on public.contact_verification_events(contact_id, occurred_at desc);

drop trigger if exists contact_verification_events_are_append_only
on public.contact_verification_events;
create trigger contact_verification_events_are_append_only
before update or delete on public.contact_verification_events
for each row execute function private.reject_mutation();

create or replace function private.protect_real_contact_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Deliberate sandbox cleanup remains supported by reset_sandbox_data().
  if old.record_mode = 'sandbox' then
    return old;
  end if;
  raise exception 'Real contacts are retained as durable commercial history';
end;
$$;

drop trigger if exists contacts_preserve_real_history on public.contacts;
create trigger contacts_preserve_real_history
before delete on public.contacts
for each row execute function private.protect_real_contact_deletion();

create or replace function private.protect_real_contact_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.record_mode <> 'real' then
    return new;
  end if;
  -- The review RPC is SECURITY DEFINER and owned by postgres. The trigger is
  -- deliberately SECURITY INVOKER, so direct authenticated/service-role SQL
  -- cannot forge this execution identity with a session setting.
  if current_user = pg_catalog.pg_get_userbyid(
    (select relowner from pg_catalog.pg_class where oid = 'public.contacts'::regclass)
  ) then
    return new;
  end if;
  raise exception 'Real contact changes require an approved proposal';
end;
$$;

drop trigger if exists contacts_require_approved_change on public.contacts;
create trigger contacts_require_approved_change
before update on public.contacts
for each row execute function private.protect_real_contact_update();

create or replace function private.contact_snapshot(p_contact public.contacts)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'provider_id', p_contact.provider_id,
    'facility_id', p_contact.facility_id,
    'full_name', p_contact.full_name,
    'title', p_contact.title,
    'email', p_contact.email,
    'phone', p_contact.phone,
    'professional_profile_url', p_contact.professional_profile_url,
    'role_category', p_contact.role_category,
    'relationship_status', p_contact.relationship_status,
    'currentness_status', p_contact.currentness_status,
    'last_observed_at', p_contact.last_observed_at,
    'last_verified_at', p_contact.last_verified_at,
    'notes', p_contact.notes
  );
$$;

create or replace function public.propose_contact_change(
  p_contact_id uuid,
  p_proposal_kind text,
  p_proposed_changes jsonb default '{}'::jsonb,
  p_observed_at timestamptz default null,
  p_source_type text default null,
  p_source_url text default null,
  p_intelligence_source_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_row public.contacts;
  proposal_id uuid;
  target_provider_id uuid;
  normalized_kind text := lower(trim(coalesce(p_proposal_kind, '')));
  normalized_changes jsonb := coalesce(p_proposed_changes, '{}'::jsonb);
begin
  if auth.uid() is null or not private.can_edit() then
    raise exception using errcode = '42501', message = 'Editor access is required';
  end if;
  if normalized_kind not in ('verification', 'change') then
    raise exception 'Proposal kind must be verification or change';
  end if;
  if jsonb_typeof(normalized_changes) <> 'object' then
    raise exception 'Proposed changes must be a JSON object';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(normalized_changes) key
    where key not in (
      'provider_id', 'facility_id', 'full_name', 'title', 'email', 'phone',
      'professional_profile_url', 'role_category', 'relationship_status',
      'currentness_status', 'last_observed_at', 'last_verified_at', 'notes'
    )
  ) then
    raise exception 'Proposed changes include an unsupported contact field';
  end if;
  if normalized_kind = 'change' and normalized_changes = '{}'::jsonb then
    raise exception 'A change proposal must include at least one field';
  end if;

  select * into contact_row
  from public.contacts
  where id = p_contact_id
  for share;
  if not found then
    raise exception 'Contact not found';
  end if;
  if contact_row.record_mode <> 'real' then
    raise exception 'Contact change history is only available for real contacts';
  end if;
  target_provider_id := case
    when normalized_changes ? 'provider_id'
      then (normalized_changes ->> 'provider_id')::uuid
    else contact_row.provider_id
  end;
  if not exists (select 1 from public.providers where id = target_provider_id) then
    raise exception 'Proposed contact provider does not exist';
  end if;
  if normalized_changes ? 'facility_id'
    and nullif(normalized_changes ->> 'facility_id', '') is not null
    and not exists (
      select 1 from public.facilities facility
      where facility.id = (normalized_changes ->> 'facility_id')::uuid
        and facility.provider_id = target_provider_id
    ) then
    raise exception 'Proposed contact facility must belong to the proposed provider';
  end if;
  if p_intelligence_source_id is not null and not exists (
    select 1
    from public.intelligence_sources source
    where source.id = p_intelligence_source_id
      and source.provider_id in (contact_row.provider_id, target_provider_id)
  ) then
    raise exception 'Contact evidence must belong to the same provider';
  end if;

  insert into public.contact_change_proposals (
    contact_id, proposal_kind, proposed_changes, previous_values,
    observed_at, source_type, source_url, intelligence_source_id,
    proposal_note, proposed_by
  ) values (
    contact_row.id, normalized_kind, normalized_changes,
    private.contact_snapshot(contact_row), p_observed_at,
    nullif(trim(p_source_type), ''), nullif(trim(p_source_url), ''),
    p_intelligence_source_id, nullif(trim(p_note), ''), auth.uid()
  ) returning id into proposal_id;

  insert into public.contact_verification_events (
    contact_id, proposal_id, event_type, previous_values, proposed_values,
    source_type, source_url, intelligence_source_id, note, performed_by
  ) values (
    contact_row.id, proposal_id, 'proposed', private.contact_snapshot(contact_row),
    normalized_changes, nullif(trim(p_source_type), ''),
    nullif(trim(p_source_url), ''), p_intelligence_source_id,
    nullif(trim(p_note), ''), auth.uid()
  );

  return proposal_id;
end;
$$;

create or replace function public.review_contact_change(
  p_proposal_id uuid,
  p_action text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal_row public.contact_change_proposals;
  contact_row public.contacts;
  resulting_snapshot jsonb;
  normalized_action text := lower(trim(coalesce(p_action, '')));
  normalized_note text := nullif(trim(p_review_note), '');
begin
  if auth.uid() is null or not private.can_edit() then
    raise exception using errcode = '42501', message = 'Editor access is required';
  end if;
  if normalized_action not in ('approve', 'reject') then
    raise exception 'Review action must be approve or reject';
  end if;

  select * into proposal_row
  from public.contact_change_proposals
  where id = p_proposal_id
  for update;
  if not found then
    raise exception 'Contact change proposal not found';
  end if;
  if proposal_row.status <> 'pending' then
    raise exception 'Contact change proposal has already been reviewed';
  end if;

  select * into contact_row
  from public.contacts
  where id = proposal_row.contact_id
  for update;
  if not found then
    raise exception 'Contact not found';
  end if;
  if normalized_action = 'approve'
    and private.contact_snapshot(contact_row) is distinct from proposal_row.previous_values then
    raise exception 'Contact changed since this proposal; create a fresh proposal';
  end if;

  if normalized_action = 'approve' then
    update public.contacts
    set provider_id = case
          when proposal_row.proposed_changes ? 'provider_id'
            then (proposal_row.proposed_changes ->> 'provider_id')::uuid
          else provider_id
        end,
        facility_id = case
          when proposal_row.proposed_changes ? 'facility_id'
            then nullif(proposal_row.proposed_changes ->> 'facility_id', '')::uuid
          else facility_id
        end,
        full_name = case
          when proposal_row.proposed_changes ? 'full_name'
            then trim(proposal_row.proposed_changes ->> 'full_name')
          else full_name
        end,
        title = case when proposal_row.proposed_changes ? 'title'
          then nullif(trim(proposal_row.proposed_changes ->> 'title'), '') else title end,
        email = case when proposal_row.proposed_changes ? 'email'
          then nullif(trim(proposal_row.proposed_changes ->> 'email'), '') else email end,
        phone = case when proposal_row.proposed_changes ? 'phone'
          then nullif(trim(proposal_row.proposed_changes ->> 'phone'), '') else phone end,
        professional_profile_url = case
          when proposal_row.proposed_changes ? 'professional_profile_url'
            then nullif(trim(proposal_row.proposed_changes ->> 'professional_profile_url'), '')
          else professional_profile_url end,
        role_category = case when proposal_row.proposed_changes ? 'role_category'
          then nullif(trim(proposal_row.proposed_changes ->> 'role_category'), '')
          else role_category end,
        relationship_status = case
          when proposal_row.proposed_changes ? 'relationship_status'
            then nullif(trim(proposal_row.proposed_changes ->> 'relationship_status'), '')
          else relationship_status end,
        currentness_status = case
          when proposal_row.proposed_changes ? 'currentness_status'
            then proposal_row.proposed_changes ->> 'currentness_status'
          when proposal_row.proposal_kind = 'verification' then 'current'
          else currentness_status end,
        last_observed_at = case
          when proposal_row.proposed_changes ? 'last_observed_at'
            then nullif(proposal_row.proposed_changes ->> 'last_observed_at', '')::timestamptz
          else coalesce(proposal_row.observed_at, last_observed_at) end,
        last_verified_at = case
          when proposal_row.proposed_changes ? 'last_verified_at'
            then nullif(proposal_row.proposed_changes ->> 'last_verified_at', '')::timestamptz
          else now() end,
        notes = case when proposal_row.proposed_changes ? 'notes'
          then nullif(trim(proposal_row.proposed_changes ->> 'notes'), '') else notes end
    where id = contact_row.id
    returning private.contact_snapshot(contacts.*) into resulting_snapshot;
  end if;

  update public.contact_change_proposals
  set status = case when normalized_action = 'approve' then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = normalized_note
  where id = proposal_row.id;

  insert into public.contact_verification_events (
    contact_id, proposal_id, event_type, previous_values, proposed_values,
    resulting_values, source_type, source_url, intelligence_source_id,
    note, performed_by
  ) values (
    contact_row.id, proposal_row.id,
    case when normalized_action = 'approve' then 'approved' else 'rejected' end,
    proposal_row.previous_values, proposal_row.proposed_changes,
    resulting_snapshot, proposal_row.source_type, proposal_row.source_url,
    proposal_row.intelligence_source_id, normalized_note, auth.uid()
  );
end;
$$;

create or replace function public.update_sandbox_contact(
  p_contact_id uuid,
  p_provider_id uuid,
  p_changes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_changes jsonb := coalesce(p_changes, '{}'::jsonb);
  updated_id uuid;
  target_facility_id uuid;
begin
  if auth.uid() is null or not private.can_edit() then
    raise exception using errcode = '42501', message = 'Editor access is required';
  end if;
  if jsonb_typeof(normalized_changes) <> 'object' then
    raise exception 'Sandbox contact changes must be a JSON object';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(normalized_changes) key
    where key not in (
      'facility_id', 'full_name', 'title', 'email', 'phone',
      'professional_profile_url', 'role_category', 'relationship_status',
      'source_type', 'source_url', 'last_verified_at', 'notes'
    )
  ) then
    raise exception 'Sandbox contact changes include an unsupported field';
  end if;

  target_facility_id := nullif(normalized_changes ->> 'facility_id', '')::uuid;
  if target_facility_id is not null and not exists (
    select 1 from public.facilities
    where id = target_facility_id and provider_id = p_provider_id
  ) then
    raise exception 'Sandbox contact facility must belong to the provider';
  end if;

  update public.contacts
  set facility_id = case when normalized_changes ? 'facility_id'
        then target_facility_id else facility_id end,
      full_name = case when normalized_changes ? 'full_name'
        then trim(normalized_changes ->> 'full_name') else full_name end,
      title = case when normalized_changes ? 'title'
        then nullif(trim(normalized_changes ->> 'title'), '') else title end,
      email = case when normalized_changes ? 'email'
        then nullif(trim(normalized_changes ->> 'email'), '') else email end,
      phone = case when normalized_changes ? 'phone'
        then nullif(trim(normalized_changes ->> 'phone'), '') else phone end,
      professional_profile_url = case
        when normalized_changes ? 'professional_profile_url'
          then nullif(trim(normalized_changes ->> 'professional_profile_url'), '')
        else professional_profile_url end,
      role_category = case when normalized_changes ? 'role_category'
        then nullif(trim(normalized_changes ->> 'role_category'), '') else role_category end,
      relationship_status = case when normalized_changes ? 'relationship_status'
        then nullif(trim(normalized_changes ->> 'relationship_status'), '')
        else relationship_status end,
      source_type = case when normalized_changes ? 'source_type'
        then nullif(trim(normalized_changes ->> 'source_type'), '') else source_type end,
      source_url = case when normalized_changes ? 'source_url'
        then nullif(trim(normalized_changes ->> 'source_url'), '') else source_url end,
      last_verified_at = case when normalized_changes ? 'last_verified_at'
        then nullif(normalized_changes ->> 'last_verified_at', '')::timestamptz
        else last_verified_at end,
      notes = case when normalized_changes ? 'notes'
        then nullif(trim(normalized_changes ->> 'notes'), '') else notes end
  where id = p_contact_id
    and provider_id = p_provider_id
    and record_mode = 'sandbox'
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Sandbox contact not found';
  end if;
  return updated_id;
end;
$$;

alter table public.contact_change_proposals enable row level security;
alter table public.contact_verification_events enable row level security;

drop policy if exists contacts_write on public.contacts;
drop policy if exists contacts_insert on public.contacts;
drop policy if exists contacts_update_sandbox on public.contacts;
drop policy if exists contacts_delete_sandbox on public.contacts;
create policy contacts_insert
on public.contacts for insert to authenticated
with check (private.can_edit());
create policy contacts_delete_sandbox
on public.contacts for delete to authenticated
using (private.can_edit() and record_mode = 'sandbox');

drop policy if exists contact_change_proposals_read
on public.contact_change_proposals;
drop policy if exists contact_verification_events_read
on public.contact_verification_events;
create policy contact_change_proposals_read
on public.contact_change_proposals for select to authenticated using (true);
create policy contact_verification_events_read
on public.contact_verification_events for select to authenticated using (true);

revoke all on public.contact_change_proposals, public.contact_verification_events
from public, anon, authenticated;
revoke all on sequence public.contact_verification_events_id_seq
from public, anon, authenticated;

grant select on public.contact_change_proposals, public.contact_verification_events
to authenticated;

grant all on public.contact_change_proposals, public.contact_verification_events
to service_role;
grant usage, select on sequence public.contact_verification_events_id_seq
to service_role;

revoke update (
  facility_id, full_name, title, email, phone, professional_profile_url,
  role_category, relationship_status, source_type, source_url,
  last_verified_at, notes, currentness_status, last_observed_at
) on public.contacts from authenticated;
revoke update on public.contacts from service_role;

revoke all on function public.propose_contact_change(
  uuid, text, jsonb, timestamptz, text, text, uuid, text
) from public, anon;
revoke all on function public.review_contact_change(uuid, text, text)
from public, anon;
revoke all on function public.update_sandbox_contact(uuid, uuid, jsonb)
from public, anon;
grant execute on function public.propose_contact_change(
  uuid, text, jsonb, timestamptz, text, text, uuid, text
) to authenticated, service_role;
grant execute on function public.review_contact_change(uuid, text, text)
to authenticated, service_role;
grant execute on function public.update_sandbox_contact(uuid, uuid, jsonb)
to authenticated, service_role;

commit;

begin;

create table public.field_visits (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  contact_id uuid references public.contacts(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'tentative'
    check (status in ('tentative', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index field_visits_schedule_idx
on public.field_visits (starts_at, ends_at)
where status <> 'cancelled';

create index field_visits_facility_idx
on public.field_visits (facility_id, starts_at desc);

create trigger field_visits_set_updated_at
before update on public.field_visits
for each row execute function private.set_updated_at();

create trigger field_visits_set_authenticated_creator
before insert on public.field_visits
for each row execute function private.set_authenticated_creator();

create or replace function private.validate_field_visit_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  facility_provider_id uuid;
  contact_provider_id uuid;
  contact_facility_id uuid;
begin
  if new.contact_id is null then
    return new;
  end if;

  select f.provider_id into facility_provider_id
  from public.facilities f
  where f.id = new.facility_id;

  select c.provider_id, c.facility_id into contact_provider_id, contact_facility_id
  from public.contacts c
  where c.id = new.contact_id;

  if contact_provider_id is null
    or contact_provider_id <> facility_provider_id
    or (contact_facility_id is not null and contact_facility_id <> new.facility_id) then
    raise exception 'Visit contact must belong to the selected facility or its provider';
  end if;

  return new;
end;
$$;

create trigger field_visits_validate_contact
before insert or update of facility_id, contact_id on public.field_visits
for each row execute function private.validate_field_visit_contact();

alter table public.field_visits enable row level security;

create policy field_visits_read on public.field_visits
for select to authenticated using (true);

create policy field_visits_write on public.field_visits
for all to authenticated
using (private.can_edit()) with check (private.can_edit());

revoke all on public.field_visits from anon, authenticated;
grant select on public.field_visits to authenticated;
grant insert (facility_id, contact_id, starts_at, ends_at, status, notes)
on public.field_visits to authenticated;
grant update (facility_id, contact_id, starts_at, ends_at, status, notes)
on public.field_visits to authenticated;
grant delete on public.field_visits to authenticated;
grant all on public.field_visits to service_role;

commit;

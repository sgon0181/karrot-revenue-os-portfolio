\set ON_ERROR_STOP on

-- Run after contact_lifecycle_replay_setup.sql and an explicit second
-- application of the migration under test.
do $$
begin
  if not exists (
    select 1 from public.contacts
    where full_name = 'Lifecycle Replay Sentinel'
      and currentness_status = 'changed_role'
      and last_observed_at is not null
  ) then
    raise exception 'Migration replay reset established contact lifecycle state';
  end if;
end;
$$;

alter table public.contacts disable trigger contacts_preserve_real_history;
delete from public.contacts
where full_name = 'Lifecycle Replay Sentinel' and record_mode = 'real';
alter table public.contacts enable trigger contacts_preserve_real_history;

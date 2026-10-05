begin;

-- Persist the OpenAI background response identifier immediately after a
-- manually-started research job is accepted. Completion remains a separate,
-- authenticated transition through complete_account_research.
create or replace function public.attach_account_research_response(
  p_job_id uuid,
  p_response_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.account_research_jobs;
  v_response_id text := nullif(btrim(p_response_id), '');
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  select * into job
  from public.account_research_jobs
  where id = p_job_id
  for update;

  if job.id is null then
    raise exception 'Research job not found';
  end if;
  if job.created_by <> auth.uid() and not private.is_owner() then
    raise exception using errcode = '42501', message = 'Not authorised for this research job';
  end if;
  if job.status <> 'running' then
    raise exception 'Research job is not running';
  end if;
  if v_response_id is null then
    raise exception using errcode = '22023', message = 'A response ID is required';
  end if;
  if job.response_id is not null and job.response_id <> v_response_id then
    raise exception 'Research job is already attached to a different response';
  end if;

  if job.response_id is null then
    update public.account_research_jobs
    set response_id = v_response_id
    where id = job.id;
  end if;
end;
$$;

revoke all on function public.attach_account_research_response(uuid, text)
from public, anon;
grant execute on function public.attach_account_research_response(uuid, text)
to authenticated, service_role;

commit;

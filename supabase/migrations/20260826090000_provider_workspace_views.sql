begin;

create table public.provider_workspace_views (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete restrict,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count bigint not null default 1 check (open_count > 0),
  primary key (user_id, provider_id),
  check (last_opened_at >= first_opened_at)
);

create index provider_workspace_views_recent_idx
on public.provider_workspace_views (user_id, last_opened_at desc, provider_id);

alter table public.provider_workspace_views enable row level security;

create policy provider_workspace_views_read_own
on public.provider_workspace_views
for select to authenticated
using (user_id = auth.uid());

create or replace function public.record_provider_workspace_view(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  opened_at timestamptz := clock_timestamp();
begin
  if viewer_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.provider_workspace_views (
    user_id,
    provider_id,
    first_opened_at,
    last_opened_at,
    open_count
  ) values (
    viewer_id,
    p_provider_id,
    opened_at,
    opened_at,
    1
  )
  on conflict (user_id, provider_id) do update set
    last_opened_at = opened_at,
    open_count = public.provider_workspace_views.open_count + 1;
end;
$$;

revoke all on public.provider_workspace_views from public, anon, authenticated;
grant select on public.provider_workspace_views to authenticated;
grant all on public.provider_workspace_views to service_role;

revoke all on function public.record_provider_workspace_view(uuid)
from public, anon;
grant execute on function public.record_provider_workspace_view(uuid)
to authenticated, service_role;

commit;

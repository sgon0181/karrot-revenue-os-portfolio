begin;

-- Intelligence tables were added after the baseline security migration's
-- blanket service-role grant. Restore the expected administrative boundary
-- for backups, hosted verification and other trusted server-side operations.
grant all on public.account_research_jobs,
  public.intelligence_sources,
  public.intelligence_claims,
  public.intelligence_claim_sources,
  public.commercial_account_facts,
  public.intelligence_review_events
to service_role;

grant usage, select on sequence public.intelligence_review_events_id_seq
to service_role;

grant execute on function public.start_account_research(uuid, text, jsonb, jsonb)
to service_role;
grant execute on function public.start_scoped_account_research(uuid, text, uuid, jsonb, jsonb)
to service_role;
grant execute on function public.complete_account_research(uuid, text, jsonb, jsonb, jsonb)
to service_role;
grant execute on function public.fail_account_research(uuid, text, text)
to service_role;
grant execute on function public.review_intelligence_claim(uuid, text, text, text)
to service_role;
grant execute on function public.research_coverage_snapshot(integer, timestamptz)
to service_role;

commit;

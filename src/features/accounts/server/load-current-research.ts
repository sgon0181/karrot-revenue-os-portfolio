import type { IntelligenceClaim } from "@/features/intelligence/lib/types";
import type { createClient } from "@/infrastructure/supabase/server";
import { summarizeResearchMemory } from "@/features/accounts/server/load-research-memory";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const JOB_FIELDS =
  "id, facility_id, research_scope, status, model, requested_at, started_at, completed_at, error_code, error_message";

function scopeQuery<T>(
  query: T,
  facilityId: string | null,
): T {
  const scoped = query as T & {
    is(column: string, value: null): T;
    eq(column: string, value: string): T;
  };
  return facilityId === null
    ? scoped.is("facility_id", null)
    : scoped.eq("facility_id", facilityId);
}

async function loadCurrentScopeJobs(
  supabase: SupabaseClient,
  providerId: string,
  facilityId: string | null,
) {
  const latestAttemptQuery = scopeQuery(
    supabase
      .from("account_research_jobs")
      .select(JOB_FIELDS)
      .eq("provider_id", providerId),
    facilityId,
  )
    .order("requested_at", { ascending: false })
    .limit(1);
  const latestCompletedQuery = scopeQuery(
    supabase
      .from("account_research_jobs")
      .select(JOB_FIELDS)
      .eq("provider_id", providerId)
      .eq("status", "completed")
      .neq("model", "operator-curated"),
    facilityId,
  )
    .order("requested_at", { ascending: false })
    .limit(1);
  const curatedQuery = scopeQuery(
    supabase
      .from("account_research_jobs")
      .select(JOB_FIELDS)
      .eq("provider_id", providerId)
      .eq("status", "completed")
      .eq("model", "operator-curated"),
    facilityId,
  ).order("requested_at", { ascending: false });

  const results = await Promise.all([
    latestAttemptQuery,
    latestCompletedQuery,
    curatedQuery,
  ]);
  for (const result of results) {
    if (result.error) throw new Error(result.error.message);
  }
  return [
    ...new Map(
      results
        .flatMap((result) => result.data ?? [])
        .map((job) => [job.id, job]),
    ).values(),
  ];
}

export async function loadCurrentResearchMemory(
  supabase: SupabaseClient,
  providerId: string,
  facilityId: string | null,
) {
  const scopes = await Promise.all([
    loadCurrentScopeJobs(supabase, providerId, null),
    ...(facilityId
      ? [loadCurrentScopeJobs(supabase, providerId, facilityId)]
      : []),
  ]);
  const jobs = scopes.flat();
  const jobIds = jobs.map((job) => job.id);
  if (!jobIds.length) {
    return { jobs: [], claims: [] as IntelligenceClaim[] };
  }

  const [claimsResult, sourcesResult] = await Promise.all([
    supabase
      .from("intelligence_claims")
      .select(
        "*, intelligence_claim_sources(intelligence_sources(id, title, publisher, url, published_at, source_updated_at, retrieved_at))",
      )
      .in("research_job_id", jobIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("intelligence_sources")
      .select("id, research_job_id")
      .in("research_job_id", jobIds),
  ]);
  if (claimsResult.error) throw new Error(claimsResult.error.message);
  if (sourcesResult.error) throw new Error(sourcesResult.error.message);

  const claims = (claimsResult.data ?? []) as unknown as IntelligenceClaim[];
  return {
    jobs: summarizeResearchMemory({
      jobs,
      claims,
      sources: sourcesResult.data ?? [],
    }),
    claims,
  };
}

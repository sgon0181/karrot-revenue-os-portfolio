import type { createClient } from "@/infrastructure/supabase/server";

export type ProviderResearchJob = {
  provider_id: string;
  status: string;
  model: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const PAGE_SIZE = 1_000;

export async function loadProviderResearchJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerIds: string[],
) {
  if (!providerIds.length) return [];
  const jobs: ProviderResearchJob[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("account_research_jobs")
      .select("provider_id, status, model, requested_at, started_at, completed_at")
      .in("provider_id", providerIds)
      .is("facility_id", null)
      .order("requested_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    jobs.push(...page);
    if (page.length < PAGE_SIZE) return jobs;
  }
}

import type {
  IntelligenceClaim,
  ResearchJob,
} from "@/features/intelligence/lib/types";
import type { Database } from "@/infrastructure/supabase/database.types";
import type { createClient } from "@/infrastructure/supabase/server";

const PAGE_SIZE = 1_000;

type ResearchJobDatabaseRow = Pick<
  Database["public"]["Tables"]["account_research_jobs"]["Row"],
  "id" | "facility_id" | "research_scope" | "status" | "model" | "requested_at" | "started_at" | "completed_at" | "error_code" | "error_message"
>;

type ResearchSourceSummary = { id: string; research_job_id: string | null };

export function summarizeResearchMemory(memory: {
  jobs: ResearchJobDatabaseRow[];
  claims: IntelligenceClaim[];
  sources: ResearchSourceSummary[];
}) {
  return memory.jobs.map((job) => {
    const jobClaims = memory.claims.filter(
      (claim) => claim.research_job_id === job.id,
    );
    return {
      ...job,
      source_count: memory.sources.filter(
        (source) => source.research_job_id === job.id,
      ).length,
      claim_count: jobClaims.length,
      people_count: new Set(
        jobClaims
          .filter((claim) => claim.category === "person" && claim.person_name)
          .map((claim) => claim.person_name),
      ).size,
      gap_count: jobClaims.filter(
        (claim) =>
          claim.category === "gap" || claim.epistemic_state === "unknown",
      ).length,
    };
  }) as ResearchJob[];
}

export async function loadResearchMemory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerId: string,
) {
  const loadJobs = async () => {
    const rows: ResearchJobDatabaseRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("account_research_jobs")
        .select("id, facility_id, research_scope, status, model, requested_at, started_at, completed_at, error_code, error_message")
        .eq("provider_id", providerId)
        .order("requested_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const page = data ?? [];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  };

  const loadClaims = async () => {
    const rows: IntelligenceClaim[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("intelligence_claims")
        .select("*, intelligence_claim_sources(intelligence_sources(id, title, publisher, url, published_at, source_updated_at, retrieved_at))")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as unknown as IntelligenceClaim[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  };

  const loadSources = async () => {
    const rows: Array<{ id: string; research_job_id: string | null }> = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("intelligence_sources")
        .select("id, research_job_id")
        .eq("provider_id", providerId)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const page = data ?? [];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  };

  const [jobs, claims, sources] = await Promise.all([loadJobs(), loadClaims(), loadSources()]);
  return { jobs, claims, sources };
}

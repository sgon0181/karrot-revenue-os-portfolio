import type {
  IntelligenceClaim,
  IntelligenceSource,
  ResearchJob,
} from "@/features/intelligence/lib/types";

export const intelligenceSectionOrder = [
  "Account Snapshot",
  "Facility Snapshot",
  "Organisation",
  "People Worth Investigating",
  "Recent Signals",
  "Operational / Strategic Context",
  "Potential Karrot Relevance",
  "What We Know",
  "What We Think",
  "What We Don't Know",
  "Research Gaps",
  "Questions Worth Asking",
  "Suggested Discovery Questions",
  "Recommended Next Step",
];

export function epistemicTone(state: string) {
  if (state === "known") return "green" as const;
  if (state === "hypothesis") return "amber" as const;
  return "slate" as const;
}

export function epistemicLabel(state: string) {
  if (state === "known") return "Supported finding";
  if (state === "hypothesis") return "Hypothesis to test";
  return "Unknown / gap";
}

export function scopeJobs(jobs: ResearchJob[], facilityId: string | null) {
  return jobs.filter((job) => job.facility_id === facilityId);
}

export function sourceList(claim: IntelligenceClaim) {
  return claim.intelligence_claim_sources
    .map((link) => link.intelligence_sources)
    .filter((source): source is IntelligenceSource => source !== null);
}

export function currentClaimsForScope(
  jobs: ResearchJob[],
  claims: IntelligenceClaim[],
  currentJobId: string | null,
) {
  const visibleJobIds = new Set([
    ...(currentJobId ? [currentJobId] : []),
    ...jobs
      .filter(
        (job) => job.status === "completed" && job.model === "operator-curated",
      )
      .map((job) => job.id),
  ]);
  return claims.filter((claim) => visibleJobIds.has(claim.research_job_id));
}

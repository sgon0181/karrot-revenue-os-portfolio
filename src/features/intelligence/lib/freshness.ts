export type ResearchLifecycle =
  | "never_researched"
  | "researching"
  | "fresh"
  | "aging"
  | "stale"
  | "failed";

export type ResearchFreshnessPolicy = {
  peopleDays: number;
  signalsDays: number;
  organisationDays: number;
  scopeFreshDays: number;
  scopeStaleDays: number;
};

export type ResearchJobFreshnessInput = {
  status: string;
  model: string;
  requested_at: string;
  started_at?: string | null;
  completed_at: string | null;
};

export const DEFAULT_RESEARCH_FRESHNESS_POLICY: ResearchFreshnessPolicy = {
  peopleDays: 30,
  signalsDays: 14,
  organisationDays: 90,
  scopeFreshDays: 14,
  scopeStaleDays: 90,
};

const ABANDONED_ACTIVE_RUN_MINUTES = 5;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function researchFreshnessPolicy(
  environment: Record<string, string | undefined> = process.env,
): ResearchFreshnessPolicy {
  const defaults = DEFAULT_RESEARCH_FRESHNESS_POLICY;
  const scopeFreshDays = positiveInteger(environment.RESEARCH_SCOPE_FRESH_DAYS, defaults.scopeFreshDays);
  const configuredScopeStaleDays = positiveInteger(environment.RESEARCH_SCOPE_STALE_DAYS, defaults.scopeStaleDays);
  return {
    peopleDays: positiveInteger(environment.RESEARCH_PEOPLE_FRESH_DAYS, defaults.peopleDays),
    signalsDays: positiveInteger(environment.RESEARCH_SIGNALS_FRESH_DAYS, defaults.signalsDays),
    organisationDays: positiveInteger(environment.RESEARCH_ORGANISATION_FRESH_DAYS, defaults.organisationDays),
    scopeFreshDays,
    scopeStaleDays: configuredScopeStaleDays > scopeFreshDays
      ? configuredScopeStaleDays
      : Math.max(defaults.scopeStaleDays, scopeFreshDays + 1),
  };
}

export function ageInDays(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

export function researchLifecycle<T extends ResearchJobFreshnessInput>(
  jobs: T[],
  policy: ResearchFreshnessPolicy,
  now = new Date(),
): {
  state: ResearchLifecycle;
  latestAttempt: T | null;
  latestCompleted: T | null;
  ageDays: number | null;
} {
  const automatedJobs = jobs
    .filter((job) => job.model !== "operator-curated")
    .sort((left, right) => right.requested_at.localeCompare(left.requested_at));
  const latestAttempt = automatedJobs[0] ?? null;
  const latestCompleted = automatedJobs.find((job) => job.status === "completed") ?? null;

  if (latestAttempt?.status === "running" || latestAttempt?.status === "queued") {
    const activeSince = new Date(latestAttempt.started_at ?? latestAttempt.requested_at).getTime();
    if (Number.isFinite(activeSince) && now.getTime() - activeSince > ABANDONED_ACTIVE_RUN_MINUTES * 60_000) {
      return { state: "failed", latestAttempt, latestCompleted, ageDays: ageInDays(latestCompleted?.completed_at, now) };
    }
    return { state: "researching", latestAttempt, latestCompleted, ageDays: ageInDays(latestCompleted?.completed_at, now) };
  }
  if (latestAttempt?.status === "failed") {
    return { state: "failed", latestAttempt, latestCompleted, ageDays: ageInDays(latestCompleted?.completed_at, now) };
  }
  if (!latestCompleted) {
    return { state: "never_researched", latestAttempt, latestCompleted: null, ageDays: null };
  }

  const ageDays = ageInDays(latestCompleted.completed_at ?? latestCompleted.requested_at, now) ?? 0;
  if (ageDays <= policy.scopeFreshDays) return { state: "fresh", latestAttempt, latestCompleted, ageDays };
  if (ageDays <= policy.scopeStaleDays) return { state: "aging", latestAttempt, latestCompleted, ageDays };
  return { state: "stale", latestAttempt, latestCompleted, ageDays };
}

export function claimFreshness(
  category: string,
  observedAt: string | null,
  epistemicState: string,
  policy: ResearchFreshnessPolicy,
  now = new Date(),
) {
  if (epistemicState !== "known") return null;
  const ageDays = ageInDays(observedAt, now);
  if (ageDays === null) return "stale" as const;
  const horizon = category === "person"
    ? policy.peopleDays
    : category === "signal"
      ? policy.signalsDays
      : policy.organisationDays;
  if (ageDays <= Math.max(1, Math.floor(horizon * 0.75))) return "fresh" as const;
  if (ageDays <= horizon) return "aging" as const;
  return "stale" as const;
}

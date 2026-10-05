import { ArrowRight, ShieldCheck } from "lucide-react";
import { researchAccount } from "@/features/intelligence/server/actions";
import { ResearchSubmitButton } from "@/features/intelligence/components/research-submit-button";
import type {
  ResearchFreshnessPolicy,
  ResearchLifecycle,
} from "@/features/intelligence/lib/freshness";
import type {
  CommercialFact,
  IntelligenceClaim,
} from "@/features/intelligence/lib/types";
import { Badge } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";

export function ResearchStatus({
  state,
  ageDays,
  completedAt,
  researchAllowed = true,
}: {
  state: ResearchLifecycle;
  ageDays: number | null;
  completedAt: string | null;
  researchAllowed?: boolean;
}) {
  if (!researchAllowed) {
    return <Badge tone="slate">Research unavailable</Badge>;
  }
  const tone =
    state === "failed" || state === "stale"
      ? "red"
      : state === "aging"
        ? "amber"
        : "slate";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64726c]">
      <Badge tone={tone}>
        {state === "researching"
          ? "Updating now"
          : state === "failed"
            ? "Refresh failed"
            : completedAt
              ? ageDays === 0
                ? "Updated today"
                : `Updated ${ageDays} day${ageDays === 1 ? "" : "s"} ago`
              : "Not researched yet"}
      </Badge>
      {completedAt ? <span>{formatDate(completedAt, true)}</span> : null}
    </div>
  );
}

export function CommercialKnowledge({
  facts,
  label,
}: {
  facts: CommercialFact[];
  label: string;
}) {
  if (!facts.length) return null;
  return (
    <section
      className="mt-5 rounded-[8px] border border-[#b8d8c8] bg-white p-4"
      aria-label={`${label} human-approved commercial knowledge`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Human approved</p>
          <h3 className="mt-1 text-sm font-semibold text-[#244136]">
            {label} commercial knowledge
          </h3>
        </div>
        <Badge tone="green">{facts.length} active</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {facts.map((fact) => (
          <div key={fact.id} className="rounded-[6px] bg-[#f4faf7] px-3 py-2.5">
            <p className="text-sm text-[#2c4037]">{fact.statement}</p>
            <p className="mt-1 text-xs text-[#64726c]">
              {fact.category} · {fact.confidence} confidence · Approved{" "}
              {formatDate(fact.approved_at)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#1f6548]">
        <ShieldCheck className="size-4" />
        Only supported known claims can cross this human-review boundary.
      </p>
    </section>
  );
}

export function ResearchAction({
  providerId,
  facilityId,
  state,
  hasCompleted,
}: {
  providerId: string;
  facilityId: string | null;
  state: ResearchLifecycle;
  hasCompleted: boolean;
}) {
  const scope = facilityId ? "Facility" : "Provider";
  const label =
    state === "researching"
      ? `Researching ${scope}…`
      : state === "failed"
        ? `Retry ${scope} Research`
        : hasCompleted
          ? `Refresh ${scope} Research`
          : `Research ${scope}`;
  return (
    <div className="max-w-[240px]">
      <form action={researchAccount} className="min-w-[190px]">
        <input type="hidden" name="provider_id" value={providerId} />
        <input type="hidden" name="research_intent" value="manual" />
        {facilityId ? (
          <input type="hidden" name="facility_id" value={facilityId} />
        ) : null}
        <ResearchSubmitButton
          label={label}
          pendingLabel={`Starting ${scope.toLowerCase()} research…`}
          disabled={state === "researching"}
        />
      </form>
      {state === "researching" ? (
        <p className="mt-1.5 text-xs leading-5 text-[#3f6655]" role="status">
          Continuing in the background. You can use any other part of the workspace.
        </p>
      ) : null}
      <p className="mt-1.5 text-xs leading-5 text-[#64726c]">
        Live public-source research typically takes 30 to 70 seconds.
      </p>
      <p className="mt-1.5 text-xs leading-5 text-[#64726c]">
        Live public-web research · uses API budget · saves a new persisted run
      </p>
    </div>
  );
}

export function CommercialFollowThrough() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#dce7e1] pt-4 text-xs font-semibold text-[#1f6548]">
      <span className="text-[#52635b]">Turn intelligence into action:</span>
      <a href="#contacts" className="inline-flex items-center gap-1 hover:underline">
        Contacts <ArrowRight className="size-3" />
      </a>
      <a href="#opportunities" className="inline-flex items-center gap-1 hover:underline">
        Opportunity <ArrowRight className="size-3" />
      </a>
      <a href="#activity" className="inline-flex items-center gap-1 hover:underline">
        Commercial note <ArrowRight className="size-3" />
      </a>
      <a href="#next-actions" className="inline-flex items-center gap-1 hover:underline">
        Next action <ArrowRight className="size-3" />
      </a>
    </div>
  );
}

export function RecommendedStep({ claims }: { claims: IntelligenceClaim[] }) {
  const recommendation = claims.find(
    (claim) => claim.section === "Recommended Next Step",
  );
  if (!recommendation) return null;
  return (
    <section
      className="mt-5 rounded-[8px] border border-[#bfd9cd] bg-white p-4"
      aria-label="Recommended next action"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="section-kicker">Recommended next action</p>
        <Badge
          tone={
            recommendation.epistemic_state === "known"
              ? "green"
              : recommendation.epistemic_state === "hypothesis"
                ? "amber"
                : "slate"
          }
        >
          {recommendation.epistemic_state === "known"
            ? "Supported finding"
            : recommendation.epistemic_state === "hypothesis"
              ? "Hypothesis to test"
              : "Unknown / gap"}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#263b32]">
        {recommendation.statement}
      </p>
      <p className="mt-2 text-xs text-[#64726c]">
        Review the supporting sources and judgement state before acting.
      </p>
    </section>
  );
}

export type { ResearchFreshnessPolicy };

import { CircleHelp, ExternalLink } from "lucide-react";
import {
  ClaimReviewControls,
  ContactFromClaim,
} from "@/features/intelligence/components/claim-review-controls";
import {
  epistemicLabel,
  epistemicTone,
  sourceList,
} from "@/features/intelligence/lib/claims";
import { claimFreshness, type ResearchFreshnessPolicy } from "@/features/intelligence/lib/freshness";
import { linkedInPersonProfileFromSources } from "@/features/intelligence/lib/linkedin-profile";
import type {
  ContactPromotionAction,
  IntelligenceClaim,
  IntelligenceReturnTab,
} from "@/features/intelligence/lib/types";
import { Badge } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";

export function ClaimCard({
  claim,
  providerId,
  facilityId,
  canEdit,
  contactAction,
  freshnessPolicy,
  showEvidence = false,
  returnFacilityId,
  returnTab = "intelligence",
}: {
  claim: IntelligenceClaim;
  providerId: string;
  facilityId: string | null;
  canEdit: boolean;
  contactAction: ContactPromotionAction;
  freshnessPolicy: ResearchFreshnessPolicy;
  showEvidence?: boolean;
  returnFacilityId?: string | null;
  returnTab?: IntelligenceReturnTab;
}) {
  const sources = sourceList(claim);
  const linkedInProfileUrl =
    claim.category === "person" && claim.person_name
      ? linkedInPersonProfileFromSources(sources)
      : null;
  const freshness = claimFreshness(
    claim.category,
    claim.observed_at,
    claim.epistemic_state,
    freshnessPolicy,
  );
  return (
    <article className="rounded-[8px] border border-[#dce7e1] bg-white p-4 shadow-[0_1px_2px_rgba(19,75,53,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={epistemicTone(claim.epistemic_state)}>
              {epistemicLabel(claim.epistemic_state)}
            </Badge>
            <span className="text-xs font-semibold text-[#64726c]">
              {claim.confidence} confidence
            </span>
            {claim.observed_at ? (
              <span className="text-xs text-[#7a8982]">
                Verified {formatDate(claim.observed_at)}
              </span>
            ) : null}
            {freshness === "stale" ? (
              <Badge tone="red">Needs checking</Badge>
            ) : freshness === "aging" ? (
              <Badge tone="amber">Check soon</Badge>
            ) : null}
          </div>
          {claim.person_name ? (
            <p className="mt-3 text-base font-semibold text-[#183128]">
              {claim.person_name}
            </p>
          ) : null}
          {claim.person_title ? (
            <p className="mt-0.5 text-sm font-medium text-[#43574e]">
              {claim.person_title}
            </p>
          ) : null}
          <p
            className={`${claim.person_name ? "mt-2" : "mt-3"} text-sm leading-6 text-[#263b32]`}
          >
            {claim.statement}
          </p>
          {claim.potential_relevance ? (
            <p className="mt-2 text-sm text-[#64726c]">
              <span className="font-semibold text-[#385348]">
                Potential relevance:
              </span>{" "}
              {claim.potential_relevance}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <ClaimReviewControls
            claim={claim}
            providerId={providerId}
            facilityId={facilityId}
            returnFacilityId={returnFacilityId}
            returnTab={returnTab}
          />
        ) : (
          <Badge tone="slate">{claim.review_status}</Badge>
        )}
      </div>
      {linkedInProfileUrl ? (
        <a
          href={linkedInProfileUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1f6548] hover:underline"
        >
          LinkedIn <ExternalLink className="size-3" />
          <span className="sr-only"> opens in a new tab</span>
        </a>
      ) : null}
      {showEvidence ? (
        <div className="mt-3 border-t border-[#e5ede9] pt-3">
          {sources.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {sources.map((source) => (
                <div key={source.id} className="min-w-0">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1.5 text-xs font-semibold text-[#1f6548] hover:underline"
                  >
                    <ExternalLink className="mt-0.5 size-3 shrink-0" />
                    {source.title}
                  </a>
                  <p className="mt-0.5 text-xs text-[#7a8982]">
                    {source.publisher ?? "Publisher not recorded"}
                    {source.published_at
                      ? ` · Published ${formatDate(source.published_at)}`
                      : ""}
                    {source.source_updated_at
                      ? ` · Updated ${formatDate(source.source_updated_at)}`
                      : ""}
                    {!source.published_at && !source.source_updated_at
                      ? ` · Retrieved ${formatDate(source.retrieved_at)}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <CircleHelp className="size-3.5" />
              No validated public source attached; this cannot be treated as
              known.
            </p>
          )}
        </div>
      ) : null}
      {canEdit ? (
        <div className="mt-3">
          <ContactFromClaim
            claim={claim}
            providerId={providerId}
            facilityId={facilityId}
            contactAction={contactAction}
            returnFacilityId={returnFacilityId}
            returnTab={returnTab}
          />
        </div>
      ) : null}
    </article>
  );
}

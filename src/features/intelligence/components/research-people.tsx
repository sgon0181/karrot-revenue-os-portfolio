import { ExternalLink } from "lucide-react";
import {
  ClaimReviewControls,
  ContactFromClaim,
} from "@/features/intelligence/components/claim-review-controls";
import {
  epistemicLabel,
  epistemicTone,
  sourceList,
} from "@/features/intelligence/lib/claims";
import {
  linkedInPersonProfileFromSources,
  linkedInPersonProfileUrl,
} from "@/features/intelligence/lib/linkedin-profile";
import type {
  ContactPromotionAction,
  IntelligenceClaim,
} from "@/features/intelligence/lib/types";
import { Badge, EmptyState } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";

export function ResearchPeople({
  providerClaims,
  facilityClaims,
  providerId,
  facilityId,
  canEdit,
  contactAction,
}: {
  providerClaims: IntelligenceClaim[];
  facilityClaims: IntelligenceClaim[];
  providerId: string;
  facilityId: string | null;
  canEdit: boolean;
  contactAction: ContactPromotionAction;
}) {
  const people = [
    ...providerClaims.map((claim) => ({ claim, claimFacilityId: null })),
    ...facilityClaims.map((claim) => ({ claim, claimFacilityId: facilityId })),
  ].filter(({ claim }) => claim.category === "person" && claim.person_name);
  if (!people.length)
    return (
      <EmptyState
        title="No researched people yet"
        description="People found in public sources will remain separate from approved CRM contacts until a human adds them."
      />
    );
  return (
    <div className="divide-y divide-[#e7edea]">
      {people.map(({ claim, claimFacilityId }) => {
        const sources = sourceList(claim);
        const linkedInProfileUrl = linkedInPersonProfileFromSources(sources);
        const evidenceSource = sources.find(
          (source) => linkedInPersonProfileUrl(source.url) === null,
        );
        return (
          <article key={claim.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[#183128]">
                    {claim.person_name}
                  </h3>
                  <Badge tone="blue">Web research candidate</Badge>
                  <Badge tone={epistemicTone(claim.epistemic_state)}>
                    {epistemicLabel(claim.epistemic_state)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-[#43574e]">
                  {claim.person_title ?? "Role not confirmed"}
                </p>
                <p className="mt-1 text-xs text-[#64726c]">
                  {claimFacilityId ? "Selected facility" : "Provider-wide"}
                  {claim.observed_at
                    ? ` · Last verified ${formatDate(claim.observed_at)}`
                    : " · Verification date unavailable"}
                </p>
                {claim.potential_relevance ? (
                  <p className="mt-2 text-sm leading-6 text-[#52635b]">
                    {claim.potential_relevance}
                  </p>
                ) : null}
                {linkedInProfileUrl || evidenceSource ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {linkedInProfileUrl ? (
                      <a
                        href={linkedInProfileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1f6548] hover:underline"
                      >
                        LinkedIn <ExternalLink className="size-3" />
                        <span className="sr-only"> opens in a new tab</span>
                      </a>
                    ) : null}
                    {evidenceSource ? (
                      <a
                        href={evidenceSource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1f6548] hover:underline"
                      >
                        Evidence <ExternalLink className="size-3" />
                        <span className="sr-only"> opens in a new tab</span>
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {canEdit ? (
                <div className="flex max-w-sm flex-col items-start gap-2">
                  <ContactFromClaim
                    claim={claim}
                    providerId={providerId}
                    facilityId={claimFacilityId}
                    contactAction={contactAction}
                    returnFacilityId={facilityId}
                    returnTab="people"
                  />
                  <ClaimReviewControls
                    claim={claim}
                    providerId={providerId}
                    facilityId={claimFacilityId}
                    returnFacilityId={facilityId}
                    returnTab="people"
                  />
                </div>
              ) : (
                <Badge tone="slate">View only</Badge>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

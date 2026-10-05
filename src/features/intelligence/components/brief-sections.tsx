import { ClaimCard } from "@/features/intelligence/components/claim-card";
import { intelligenceSectionOrder } from "@/features/intelligence/lib/claims";
import type { ResearchFreshnessPolicy } from "@/features/intelligence/lib/freshness";
import type {
  ContactPromotionAction,
  IntelligenceClaim,
  IntelligenceReturnTab,
} from "@/features/intelligence/lib/types";
import { EmptyState, SectionTitle } from "@/shared/components/ui";

export function BriefSections({
  claims,
  providerId,
  facilityId,
  canEdit,
  contactAction,
  freshnessPolicy,
  researchAllowed = true,
  showEvidence = false,
  returnFacilityId,
  returnTab = "intelligence",
}: {
  claims: IntelligenceClaim[];
  providerId: string;
  facilityId: string | null;
  canEdit: boolean;
  contactAction: ContactPromotionAction;
  freshnessPolicy: ResearchFreshnessPolicy;
  researchAllowed?: boolean;
  showEvidence?: boolean;
  returnFacilityId?: string | null;
  returnTab?: IntelligenceReturnTab;
}) {
  const grouped = intelligenceSectionOrder
    .map((section) => ({
      section,
      claims: claims.filter((claim) => claim.section === section),
    }))
    .filter((group) => group.claims.length > 0);
  if (!grouped.length)
    return (
      <EmptyState
        title="No intelligence yet"
        description={researchAllowed
          ? "Run live research or add sourced evidence. Unknowns remain visible rather than being guessed."
          : "Web intelligence is not available for this account."}
      />
    );
  return (
    <div className="space-y-7">
      {grouped.map((group) => (
        <div key={group.section}>
          <SectionTitle title={group.section} />
          <div className="mt-3 grid gap-3">
            {group.claims.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                providerId={providerId}
                facilityId={facilityId}
                canEdit={canEdit}
                contactAction={contactAction}
                freshnessPolicy={freshnessPolicy}
                showEvidence={showEvidence}
                returnFacilityId={returnFacilityId}
                returnTab={returnTab}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

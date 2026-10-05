import type { IntelligenceTabData } from "@/features/accounts/server/load-provider-tabs";
import type { ProviderWorkspaceCore } from "@/features/accounts/server/load-provider-workspace-core";
import { saveContact } from "@/features/accounts/server/actions";
import {
  AccountIntelligence,
  FacilityIntelligence,
} from "@/features/intelligence/components/account-intelligence";
import type { ResearchFreshnessPolicy } from "@/features/intelligence/lib/freshness";
import { EmptyState, SectionTitle } from "@/shared/components/ui";

export function IntelligencePanel({
  core,
  data,
  providerId,
  freshnessPolicy,
}: {
  core: ProviderWorkspaceCore;
  data: IntelligenceTabData;
  providerId: string;
  freshnessPolicy: ResearchFreshnessPolicy;
}) {
  if (core.provider.is_sample) {
    return (
      <div className="space-y-5">
        <section className="card">
          <div className="panel-header">
            <SectionTitle
              title="Web intelligence"
              description="Public-web research for authoritative provider records."
            />
          </div>
          <EmptyState
            title="Research unavailable"
            description="No authoritative provider source is attached to this account. Its CRM and commercial records remain fully available."
          />
        </section>
        <p className="rounded-[7px] border border-[#dce6e1] bg-[#f8faf9] px-4 py-3 text-sm leading-6 text-[#52635b]">
          Meeting preparation, post-visit capture and drafted communications are the next milestones and are deliberately not automated yet. Research assists; humans decide.
        </p>
      </div>
    );
  }
  const researchConfigured = Boolean(process.env.OPENAI_API_KEY);
  return (
    <div className="space-y-5">
      <AccountIntelligence
        providerId={providerId}
        providerName={core.provider.business_name}
        facilities={core.facilities}
        canEdit={core.canEdit}
        contactAction={saveContact}
        jobs={data.researchJobs}
        claims={data.intelligenceClaims}
        approvedFacts={data.approvedFacts}
        defaultFacilityId={core.selectedFacilityId}
        researchAllowed={!core.provider.is_sample}
        researchConfigured={researchConfigured}
        freshnessPolicy={freshnessPolicy}
      />
      {core.selectedFacility ? (
        <section className="rounded-[9px] border border-[#dce6e1] bg-white p-4 sm:p-5">
          <div className="mb-3">
            <p className="section-kicker">Selected facility</p>
            <h2 className="mt-1 text-lg font-semibold text-[#183128]">
              {core.selectedFacility.name}
            </h2>
          </div>
          <FacilityIntelligence
            providerId={providerId}
            facilityId={core.selectedFacility.id}
            facilityName={core.selectedFacility.name}
            canEdit={core.canEdit}
            contactAction={saveContact}
            jobs={data.researchJobs}
            claims={data.intelligenceClaims}
            approvedFacts={data.approvedFacts}
            researchAllowed={!core.provider.is_sample}
            researchConfigured={researchConfigured}
            freshnessPolicy={freshnessPolicy}
            selected
          />
        </section>
      ) : (
        <div className="rounded-[7px] border border-[#dce6e1] bg-white p-4 text-sm text-[#52635b]">
          Choose a facility from Overview to inspect or refresh local
          intelligence. Provider intelligence remains provider-wide.
        </div>
      )}
      <p className="rounded-[7px] border border-[#dce6e1] bg-[#f8faf9] px-4 py-3 text-sm leading-6 text-[#52635b]">
        Meeting preparation, post-visit capture and drafted communications are the next milestones and are deliberately not automated yet. Research assists; humans decide.
      </p>
    </div>
  );
}

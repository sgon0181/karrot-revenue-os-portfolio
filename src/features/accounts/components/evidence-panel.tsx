import { ExternalLink, FileCheck2 } from "lucide-react";
import { GovernmentSnapshot } from "@/features/accounts/components/provider-workspace-shared";
import type { EvidenceTabData } from "@/features/accounts/server/load-provider-tabs";
import type { ProviderWorkspaceCore } from "@/features/accounts/server/load-provider-workspace-core";
import { saveContact } from "@/features/accounts/server/actions";
import {
  AccountIntelligence,
  FacilityIntelligence,
} from "@/features/intelligence/components/account-intelligence";
import type { ResearchFreshnessPolicy } from "@/features/intelligence/lib/freshness";
import { Badge, EmptyState, SectionTitle } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";

export function EvidencePanel({
  core,
  data,
  providerId,
  freshnessPolicy,
}: {
  core: ProviderWorkspaceCore;
  data: EvidenceTabData;
  providerId: string;
  freshnessPolicy: ResearchFreshnessPolicy;
}) {
  return (
    <div className="space-y-5">
      <section id="provenance" className="card scroll-mt-24">
        <div className="panel-header">
          <SectionTitle
            title={core.provider.is_sample ? "Source records" : "Government source records"}
            description={core.provider.is_sample
              ? "External source records attached to this account."
              : "Detailed publication, row locator and checksum information."}
          />
          <Badge tone="blue">{data.provenance.length} records</Badge>
        </div>
        {data.provenance.length ? (
          <div className="divide-y divide-[#e7edea] px-4">
            {data.provenance.map((snapshot) => (
              <div key={snapshot.id} className="flex items-start gap-3 py-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#dff8ec] text-[#1f6548]">
                  <FileCheck2 className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#2c4037]">
                    {snapshot.source_files?.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#64726c]">
                    {snapshot.source_files?.publisher} ·{" "}
                    {snapshot.source_records?.sheet_name}, row{" "}
                    {snapshot.source_records?.row_number} · As at{" "}
                    {formatDate(snapshot.source_files?.source_as_of_date)}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-[#64726c]">
                    SHA-256 {snapshot.source_files?.sha256}
                  </p>
                  {snapshot.source_files?.source_url ? (
                    <a
                      href={snapshot.source_files.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1f6548] hover:underline"
                    >
                      Open source <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={core.provider.is_sample ? "No source records" : "No provenance loaded"}
            description={core.provider.is_sample
              ? "This account was entered directly and has no external source records."
              : "Provider source records appear after import."}
          />
        )}
      </section>
      {core.selectedFacility ? (
        <GovernmentSnapshot facility={core.selectedFacility} evidence />
      ) : (
        <details className="card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#385348]">
            {core.provider.is_sample ? "Facility details" : "Government evidence"} for all {core.facilities.length} {core.facilities.length === 1 ? "facility" : "facilities"}
          </summary>
          <div className="grid gap-4 border-t border-[#e7edea] p-4 lg:grid-cols-2">
            {core.facilities.map((facility) => (
              <GovernmentSnapshot key={facility.id} facility={facility} evidence />
            ))}
          </div>
        </details>
      )}
      <details className="card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#385348]">
          Contact verification and change history (
          {data.contactVerificationEvents.length})
        </summary>
        <div className="divide-y divide-[#e7edea] border-t border-[#e7edea] px-4">
          {data.contactChangeProposals.map((proposal) => {
            const contact = data.contacts.find(
              (item) => item.id === proposal.contact_id,
            );
            const events = data.contactVerificationEvents.filter(
              (event) => event.proposal_id === proposal.id,
            );
            return (
              <div key={proposal.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#2c4037]">
                    {contact?.full_name ?? "Retained contact"}
                  </p>
                  <Badge
                    tone={
                      proposal.status === "approved"
                        ? "green"
                        : proposal.status === "rejected"
                          ? "red"
                          : "amber"
                    }
                  >
                    {proposal.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-[#64726c]">
                  Proposed {formatDate(proposal.proposed_at, true)} ·{" "}
                  {proposal.proposal_kind}
                </p>
                <p className="mt-2 break-words text-xs leading-5 text-[#52635b]">
                  Before: {JSON.stringify(proposal.previous_values)}
                  <br />
                  Proposed: {JSON.stringify(proposal.proposed_changes)}
                </p>
                {events.length ? (
                  <p className="mt-2 text-xs font-semibold text-[#64726c]">
                    {events
                      .map(
                        (event) =>
                          `${event.event_type} ${formatDate(event.occurred_at, true)}`,
                      )
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            );
          })}
          {!data.contactChangeProposals.length ? (
            <EmptyState
              title="No contact change history"
              description="Future verification and change proposals will remain auditable here."
            />
          ) : null}
        </div>
      </details>
      {!core.provider.is_sample ? <>
      <details className="card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#385348]">
          Intelligence review audit ({data.intelligenceReviewEvents.length})
        </summary>
        <div className="divide-y divide-[#e7edea] border-t border-[#e7edea] px-4">
          {data.intelligenceReviewEvents.map((event) => (
            <div key={event.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={event.action === "rejected" ? "red" : "green"}>
                  {event.action}
                </Badge>
                <p className="text-xs text-[#64726c]">
                  {formatDate(event.reviewed_at, true)} ·{" "}
                  {event.profiles?.display_name ?? "Workspace reviewer"}
                </p>
              </div>
              {event.resulting_statement ? (
                <p className="mt-2 text-sm leading-6 text-[#2c4037]">
                  {event.resulting_statement}
                </p>
              ) : null}
              {event.note ? (
                <p className="mt-1 text-xs text-[#64726c]">{event.note}</p>
              ) : null}
            </div>
          ))}
          {!data.intelligenceReviewEvents.length ? (
            <EmptyState
              title="No intelligence review history"
              description="Approve, correct and reject decisions remain visible here."
            />
          ) : null}
        </div>
      </details>
      <details className="card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#385348]">
          Approved knowledge history ({data.commercialFactHistory.length})
        </summary>
        <div className="divide-y divide-[#e7edea] border-t border-[#e7edea] px-4">
          {data.commercialFactHistory.map((fact) => (
            <div key={fact.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={fact.is_active ? "green" : "slate"}>
                  {fact.is_active ? "Current" : "Superseded"}
                </Badge>
                <span className="text-xs text-[#64726c]">
                  {fact.facility_id ? "Facility" : "Provider-wide"} · Approved{" "}
                  {formatDate(fact.approved_at, true)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#2c4037]">
                {fact.statement}
              </p>
            </div>
          ))}
          {!data.commercialFactHistory.length ? (
            <EmptyState
              title="No approved knowledge history"
              description="Supported findings appear here after human approval."
            />
          ) : null}
        </div>
      </details>
      </> : null}
      {!core.provider.is_sample ? <section className="card p-4">
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
          researchConfigured={Boolean(process.env.OPENAI_API_KEY)}
          freshnessPolicy={freshnessPolicy}
          view="evidence"
        />
        {core.selectedFacility ? (
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
            researchConfigured={Boolean(process.env.OPENAI_API_KEY)}
            freshnessPolicy={freshnessPolicy}
            selected
            view="evidence"
          />
        ) : null}
      </section> : null}
    </div>
  );
}

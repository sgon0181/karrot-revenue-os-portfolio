import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProviderFacilitiesSection } from "@/features/accounts/components/provider-facilities-section";
import {
  FacilitySwitcher,
  GovernmentSnapshot,
} from "@/features/accounts/components/provider-workspace-shared";
import { providerWorkspaceTabHref } from "@/features/accounts/lib/provider-workspace-tabs";
import type { OverviewTabData } from "@/features/accounts/server/load-provider-tabs";
import type { ProviderWorkspaceCore } from "@/features/accounts/server/load-provider-workspace-core";
import {
  currentClaimsForScope,
} from "@/features/intelligence/lib/claims";
import { researchLifecycle, type ResearchFreshnessPolicy } from "@/features/intelligence/lib/freshness";
import type { IntelligenceClaim } from "@/features/intelligence/lib/types";
import { RecommendedStep } from "@/features/intelligence/components/research-status-controls";
import { Badge, EmptyState, SectionTitle } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";

function currentClaims(
  jobs: OverviewTabData["researchJobs"],
  claims: IntelligenceClaim[],
  facilityId: string | null,
  freshnessPolicy: ResearchFreshnessPolicy,
) {
  const scopedJobs = jobs.filter((job) => job.facility_id === facilityId);
  const lifecycle = researchLifecycle(scopedJobs, freshnessPolicy);
  return currentClaimsForScope(
    scopedJobs,
    claims,
    lifecycle.latestCompleted?.id ?? null,
  );
}

export function OverviewPanel({
  core,
  data,
  providerId,
  returnTo,
  freshnessPolicy,
}: {
  core: ProviderWorkspaceCore;
  data: OverviewTabData;
  providerId: string;
  returnTo: string | null;
  freshnessPolicy: ResearchFreshnessPolicy;
}) {
  const {
    provider,
    facilities,
    selectedFacility,
    selectedFacilityId,
    header,
  } = core;
  const researchAllowed = !provider.is_sample;
  const providerClaims = currentClaims(
    data.researchJobs,
    data.intelligenceClaims,
    null,
    freshnessPolicy,
  );
  const selectedClaims = selectedFacilityId
    ? currentClaims(
        data.researchJobs,
        data.intelligenceClaims,
        selectedFacilityId,
        freshnessPolicy,
      )
    : [];
  const recommendationClaims = [...selectedClaims, ...providerClaims];
  const unknowns = recommendationClaims
    .filter(
      (claim) => claim.epistemic_state !== "known" || claim.category === "gap",
    )
    .slice(0, 3);
  const researchedPeople = recommendationClaims
    .filter((claim) => claim.category === "person" && claim.person_name)
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div
        id="overview"
        className="grid scroll-mt-24 gap-5 xl:grid-cols-[1.15fr_0.85fr]"
      >
        <div>
          {selectedFacility ? (
            <GovernmentSnapshot facility={selectedFacility} />
          ) : (
            <section className="card p-5">
              <p className="section-kicker">Account overview</p>
              <h2 className="mt-1 text-lg font-semibold text-[#183128]">
                Choose a facility for local context
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#64726c]">
                {provider.business_name} has {facilities.length} current NSW
                {facilities.length === 1 ? " facility" : " facilities"}.
                {researchAllowed
                  ? " Provider-wide commercial and web intelligence remain available without selecting a home."
                  : " Choose a facility to see its address and planning context."}
              </p>
            </section>
          )}
        </div>
        <section className="card">
          <div className="panel-header">
            <SectionTitle
              title="What happens next"
              description="The latest commercial context for this account."
            />
          </div>
          <div className="space-y-4 p-4">
            <div>
              <p className="section-kicker">Next action</p>
              <p className="mt-1 font-semibold text-[#183128]">
                {header.nextOpenAction?.title ?? "No next action scheduled"}
              </p>
              <p className="mt-1 text-xs text-[#64726c]">
                {formatDate(header.nextOpenAction?.due_at, true)}
              </p>
            </div>
            <div className="border-t border-[#e7edea] pt-4">
              <p className="section-kicker">Last activity</p>
              <p className="mt-1 font-semibold text-[#183128]">
                {header.latestActivity?.subject ?? "No activity recorded"}
              </p>
              <p className="mt-1 text-xs text-[#64726c]">
                {formatDate(header.latestActivity?.occurred_at, true)}
              </p>
            </div>
            <Link
              href={providerWorkspaceTabHref(
                providerId,
                "commercial",
                selectedFacilityId,
                undefined,
                returnTo,
              )}
              className="text-link inline-flex items-center gap-1"
            >
              Open commercial workspace <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>
      </div>
      <ProviderFacilitiesSection>
        <div className="panel-header">
          <SectionTitle
            title="Facilities"
            description="Switch the selected home without leaving the account."
          />
          <Badge tone="green">{facilities.length} current</Badge>
        </div>
        <div className="p-4">
          <FacilitySwitcher
            providerId={providerId}
            facilities={facilities}
            selectedFacilityId={selectedFacilityId}
            returnTo={returnTo}
          />
        </div>
      </ProviderFacilitiesSection>
      <div className={researchAllowed ? "grid gap-5 xl:grid-cols-2" : "grid gap-5"}>
        <section className="card">
          <div className="panel-header">
            <SectionTitle
              title="People"
              description={researchAllowed
                ? "Approved CRM contacts and researched candidates."
                : "CRM contacts recorded for this account."}
            />
            <Link
              href={providerWorkspaceTabHref(
                providerId,
                "people",
                selectedFacilityId,
                undefined,
                returnTo,
              )}
              className="text-link"
            >
              View all
            </Link>
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-[#183128]">
              {header.contactCount} CRM contacts
            </p>
            {data.contacts.map((contact) => (
              <p key={contact.id} className="mt-2 text-sm text-[#52635b]">
                {contact.full_name} · {contact.title ?? "Role not recorded"}
              </p>
            ))}
            {researchedPeople.length ? (
              <>
                <p className="mt-4 border-t border-[#e7edea] pt-4 text-xs font-semibold uppercase tracking-[0.06em] text-[#64726c]">
                  Web research candidates
                </p>
                {researchedPeople.map((person) => (
                  <p key={person.id} className="mt-2 text-sm text-[#52635b]">
                    {person.person_name} · {person.person_title ?? "Role not confirmed"}
                  </p>
                ))}
              </>
            ) : null}
          </div>
        </section>
        {researchAllowed ? <section className="card">
          <div className="panel-header">
            <SectionTitle
              title="Recommended next step"
              description="A research recommendation—not an automatic action."
            />
            <Link
              href={providerWorkspaceTabHref(
                providerId,
                "intelligence",
                selectedFacilityId,
                undefined,
                returnTo,
              )}
              className="text-link"
            >
              Open intelligence
            </Link>
          </div>
          <div className="p-4">
            <RecommendedStep claims={recommendationClaims} />
            {!recommendationClaims.some(
              (claim) => claim.section === "Recommended Next Step",
            ) ? (
              <EmptyState
                title="No research recommendation yet"
                description="Research only starts when an authorised person clicks Research or Refresh."
              />
            ) : null}
          </div>
        </section> : null}
      </div>
      {researchAllowed ? <section className="card">
        <div className="panel-header">
          <SectionTitle
            title="Questions and unknowns"
            description="Unconfirmed information stays visible as work to do, not fact."
          />
          <Link
            href={providerWorkspaceTabHref(
              providerId,
              "intelligence",
              selectedFacilityId,
              undefined,
              returnTo,
            )}
            className="text-link"
          >
            Review intelligence
          </Link>
        </div>
        {unknowns.length ? (
          <div className="divide-y divide-[#e7edea] px-4">
            {unknowns.map((claim) => (
              <div key={claim.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">
                    {claim.epistemic_state === "hypothesis"
                      ? "Hypothesis to test"
                      : "Unknown"}
                  </Badge>
                  <span className="text-xs text-[#64726c]">{claim.section}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#2c4037]">
                  {claim.statement}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No open research questions"
            description="Evidence and earlier history remain available in the Evidence tab."
          />
        )}
      </section> : null}
    </div>
  );
}

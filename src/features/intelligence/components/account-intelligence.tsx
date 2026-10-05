import Link from "next/link";
import { ArrowRight, BrainCircuit, Plus } from "lucide-react";
import { addManualIntelligence } from "@/features/intelligence/server/actions";
import { BriefSections } from "@/features/intelligence/components/brief-sections";
import { ResearchHistory } from "@/features/intelligence/components/research-history";
import {
  CommercialFollowThrough,
  CommercialKnowledge,
  RecommendedStep,
  ResearchAction,
  ResearchStatus,
} from "@/features/intelligence/components/research-status-controls";
import {
  currentClaimsForScope,
  intelligenceSectionOrder,
  scopeJobs,
} from "@/features/intelligence/lib/claims";
import {
  researchLifecycle,
  type ResearchFreshnessPolicy,
} from "@/features/intelligence/lib/freshness";
import type {
  CommercialFact,
  ContactPromotionAction,
  FacilityOption,
  IntelligenceClaim,
  ResearchJob,
} from "@/features/intelligence/lib/types";
import {
  DisclosureForm,
  Field,
  SelectField,
  TextAreaField,
} from "@/shared/components/forms";
import { SubmitButton } from "@/shared/components/submit-button";
import { Badge } from "@/shared/components/ui";

export { ResearchPeople } from "@/features/intelligence/components/research-people";
export { RecommendedStep } from "@/features/intelligence/components/research-status-controls";
export { currentClaimsForScope } from "@/features/intelligence/lib/claims";
export type {
  CommercialFact,
  IntelligenceClaim,
  IntelligenceSource,
  ResearchJob,
} from "@/features/intelligence/lib/types";

function ManualFindingForm({
  providerId,
  providerName,
  facilities,
  defaultFacilityId,
}: {
  providerId: string;
  providerName: string;
  facilities: FacilityOption[];
  defaultFacilityId: string | null;
}) {
  return (
    <DisclosureForm label="Add sourced finding">
      <form action={addManualIntelligence} className="space-y-4">
        <input type="hidden" name="provider_id" value={providerId} />
        <p className="text-sm text-[#64726c]">
          Capture a finding from an official page, report, biography or
          announcement. It remains pending until separately reviewed.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Research scope"
            name="facility_id"
            defaultValue={defaultFacilityId ?? undefined}
          >
            <option value="">Provider-wide</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </SelectField>
          <Field label="Source title" name="source_title" required />
          <Field label="Publisher" name="publisher" />
          <Field label="Source URL" name="source_url" type="url" required />
          <Field label="Published" name="published_at" type="date" />
          <Field label="Source updated" name="source_updated_at" type="date" />
          <SelectField
            label="Source type"
            name="source_type"
            defaultValue="official_provider"
            required
          >
            <option value="official_provider">Official provider</option>
            <option value="official_government">Government</option>
            <option value="annual_report">Annual report</option>
            <option value="news">News</option>
            <option value="professional_profile">Professional profile</option>
            <option value="conference">Conference biography</option>
            <option value="other">Other</option>
          </SelectField>
          <SelectField
            label="Brief section"
            name="section"
            defaultValue="Account Snapshot"
            required
          >
            {intelligenceSectionOrder.map((section) => (
              <option key={section}>{section}</option>
            ))}
          </SelectField>
          <SelectField
            label="Category"
            name="category"
            defaultValue="organisation"
            required
          >
            <option value="organisation">Organisation</option>
            <option value="person">Person</option>
            <option value="signal">Signal</option>
            <option value="gap">Gap</option>
            <option value="hypothesis">Hypothesis</option>
            <option value="approach">Approach</option>
          </SelectField>
          <SelectField
            label="Epistemic state"
            name="epistemic_state"
            defaultValue="known"
            required
          >
            <option value="known">Known</option>
            <option value="hypothesis">Hypothesis</option>
            <option value="unknown">Unknown</option>
          </SelectField>
          <SelectField
            label="Confidence"
            name="confidence"
            defaultValue="high"
            required
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </SelectField>
          <Field label="Observed / verified" name="observed_at" type="date" />
          <Field label="Person name (when applicable)" name="person_name" />
          <Field label="Person title" name="person_title" />
        </div>
        <TextAreaField
          label="Finding"
          name="statement"
          placeholder={`What does the source establish about ${providerName}?`}
        />
        <TextAreaField
          label="Potential relevance"
          name="potential_relevance"
          placeholder="Role in a possible conversation—not assumed buying authority."
        />
        <TextAreaField label="Source excerpt / evidence note" name="excerpt" />
        <SubmitButton pendingLabel="Capturing evidence…">
          <Plus className="size-4" />
          Add for review
        </SubmitButton>
      </form>
    </DisclosureForm>
  );
}

function ResearchRunNotice({
  state,
  errorMessage,
  scope,
}: {
  state: string;
  errorMessage?: string | null;
  scope: "provider" | "facility";
}) {
  if (state === "researching") {
    return (
      <div className="mt-4 rounded-[7px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Researching current public sources and building an evidence-backed {scope}{" "}
        brief. This may take around a minute.
      </div>
    );
  }
  if (state !== "failed") return null;
  return (
    <div className="mt-4 rounded-[7px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <span className="font-semibold">Latest run failed.</span>{" "}
      {errorMessage ?? "No supported brief was saved."} Previous {scope}{" "}
      intelligence remains available.
    </div>
  );
}

export function AccountIntelligence({
  providerId,
  providerName,
  facilities,
  canEdit,
  contactAction,
  jobs,
  claims,
  approvedFacts,
  defaultFacilityId,
  researchAllowed,
  researchConfigured,
  freshnessPolicy,
  view = "intelligence",
}: {
  providerId: string;
  providerName: string;
  facilities: FacilityOption[];
  canEdit: boolean;
  contactAction: ContactPromotionAction;
  jobs: ResearchJob[];
  claims: IntelligenceClaim[];
  approvedFacts: CommercialFact[];
  defaultFacilityId: string | null;
  researchAllowed: boolean;
  researchConfigured: boolean;
  freshnessPolicy: ResearchFreshnessPolicy;
  view?: "intelligence" | "evidence";
}) {
  const providerJobs = scopeJobs(jobs, null);
  const lifecycle = researchLifecycle(providerJobs, freshnessPolicy);
  const latestCompletedId = lifecycle.latestCompleted?.id ?? null;
  const latestCompleted =
    providerJobs.find((job) => job.id === latestCompletedId) ?? null;
  const visibleClaims = currentClaimsForScope(
    providerJobs,
    claims,
    latestCompletedId,
  );
  const providerFacts = approvedFacts.filter((fact) => fact.facility_id === null);
  const currentFacilityIds = new Set(facilities.map((facility) => facility.id));
  const archivedFacilityIds = [
    ...new Set(
      [
        ...jobs.map((job) => job.facility_id),
        ...approvedFacts.map((fact) => fact.facility_id),
      ].filter((facilityId): facilityId is string =>
        Boolean(facilityId && !currentFacilityIds.has(facilityId)),
      ),
    ),
  ];

  if (view === "evidence") {
    return (
      <section
        className="scroll-mt-24"
        id="account-evidence"
        aria-labelledby="account-evidence-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Web intelligence evidence</p>
            <h2
              id="account-evidence-title"
              className="mt-1 text-lg font-semibold text-[#183128]"
            >
              Sources, history and review trail
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#64726c]">
              Inspect the current evidence, earlier saved runs, failures,
              rejected material and human-approved commercial knowledge.
            </p>
          </div>
          <Badge tone="blue">{providerJobs.length} provider runs</Badge>
        </div>
        {visibleClaims.length ? (
          <details
            className="mt-4 rounded-[8px] border border-[#dce7e1] bg-white"
            open
          >
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#1f6548]">
              Current provider sources and findings
            </summary>
            <div className="border-t border-[#e7edea] p-4">
              <BriefSections
                claims={visibleClaims}
                providerId={providerId}
                facilityId={null}
                canEdit={canEdit}
                contactAction={contactAction}
                freshnessPolicy={freshnessPolicy}
                researchAllowed={researchAllowed}
                showEvidence
                returnFacilityId={defaultFacilityId}
                returnTab="evidence"
              />
            </div>
          </details>
        ) : null}
        <ResearchHistory
          jobs={providerJobs}
          currentJobId={latestCompletedId}
          claims={claims}
          providerId={providerId}
          facilityId={null}
          canEdit={canEdit}
          contactAction={contactAction}
          freshnessPolicy={freshnessPolicy}
          returnFacilityId={defaultFacilityId}
          returnTab="evidence"
        />
        <CommercialKnowledge facts={providerFacts} label="Provider" />
        {archivedFacilityIds.length ? (
          <details className="mt-4 rounded-[8px] border border-[#dce7e1] bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#385348]">
              Archived facility research ({archivedFacilityIds.length})
            </summary>
            <div className="space-y-4 border-t border-[#e7edea] p-4">
              {archivedFacilityIds.map((facilityId) => {
                const archivedJobs = scopeJobs(jobs, facilityId);
                const archivedLifecycle = researchLifecycle(
                  archivedJobs,
                  freshnessPolicy,
                );
                return (
                  <div key={facilityId}>
                    <p className="text-xs font-semibold text-[#52635b]">
                      Former facility record · {facilityId}
                    </p>
                    <ResearchHistory
                      jobs={archivedJobs}
                      currentJobId={archivedLifecycle.latestCompleted?.id ?? null}
                      claims={claims}
                      providerId={providerId}
                      facilityId={facilityId}
                      canEdit={canEdit}
                      contactAction={contactAction}
                      freshnessPolicy={freshnessPolicy}
                      returnTab="evidence"
                    />
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="scroll-mt-24 rounded-[9px] border border-[#bed8cc] bg-[#f7fbf9] p-4 sm:p-5"
      id="account-intelligence"
      aria-labelledby="account-intelligence-title"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-kicker">Web intelligence · Provider-wide</p>
          <h2
            id="account-intelligence-title"
            className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-[-0.025em] text-[#183128]"
          >
            <BrainCircuit className="size-5 text-[#1f6548]" />
            Provider intelligence
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64726c]">
            Current public-web research about {providerName}. Supported
            findings, hypotheses and unanswered questions stay visibly distinct.
          </p>
          <div className="mt-3">
            <ResearchStatus
              state={lifecycle.state}
              ageDays={lifecycle.ageDays}
              completedAt={latestCompleted?.completed_at ?? null}
              researchAllowed={researchAllowed}
            />
          </div>
          {latestCompleted ? (
            <p className="mt-2 text-xs text-[#64726c]">
              {latestCompleted.source_count} sources · {latestCompleted.claim_count}{" "}
              findings · {latestCompleted.people_count} people ·{" "}
              {latestCompleted.gap_count} gaps
            </p>
          ) : null}
        </div>
        {canEdit && researchAllowed ? (
          <div className="flex flex-wrap items-start gap-2">
            <ResearchAction
              providerId={providerId}
              facilityId={null}
              state={lifecycle.state}
              hasCompleted={Boolean(latestCompleted)}
            />
            <ManualFindingForm
              providerId={providerId}
              providerName={providerName}
              facilities={facilities}
              defaultFacilityId={defaultFacilityId}
            />
          </div>
        ) : null}
      </div>
      {researchAllowed && !researchConfigured ? (
        <div className="mt-4 rounded-[7px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">
            Automated research awaits local server configuration.
          </span>{" "}
          A click records a truthful failed run; no synthetic fallback brief is
          created.
        </div>
      ) : null}
      <ResearchRunNotice
        state={lifecycle.state}
        errorMessage={lifecycle.latestAttempt?.error_message}
        scope="provider"
      />
      <RecommendedStep claims={visibleClaims} />
      {visibleClaims.length ? (
        <details className="mt-5 rounded-[8px] border border-[#dce7e1] bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#1f6548]">
            Inspect current provider brief ({visibleClaims.length} findings)
          </summary>
          <div className="border-t border-[#e7edea] p-4">
            <BriefSections
              claims={visibleClaims}
              providerId={providerId}
              facilityId={null}
              canEdit={canEdit}
              contactAction={contactAction}
              freshnessPolicy={freshnessPolicy}
              researchAllowed={researchAllowed}
              returnFacilityId={defaultFacilityId}
            />
          </div>
        </details>
      ) : (
        <div className="mt-6">
          <BriefSections
            claims={visibleClaims}
            providerId={providerId}
            facilityId={null}
            canEdit={canEdit}
            contactAction={contactAction}
            freshnessPolicy={freshnessPolicy}
            researchAllowed={researchAllowed}
            returnFacilityId={defaultFacilityId}
          />
        </div>
      )}
      <details className="mt-4 rounded-[7px] border border-[#dce7e1] bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#385348]">
          How review decisions work
        </summary>
        <div className="border-t border-[#e7edea] px-4 py-3 text-sm leading-6 text-[#52635b]">
          <p>
            <strong>Approve</strong> promotes a supported finding into
            human-approved commercial knowledge. <strong>Correct</strong> edits
            and approves it. <strong>Reject</strong> retains the audit record but
            excludes it from approved knowledge. Hypotheses and gaps stay as
            questions and cannot be promoted.
          </p>
        </div>
      </details>
      <CommercialFollowThrough />
    </section>
  );
}

export function FacilityIntelligence({
  providerId,
  facilityId,
  facilityName,
  canEdit,
  contactAction,
  jobs,
  claims,
  approvedFacts,
  researchAllowed,
  researchConfigured,
  freshnessPolicy,
  selected,
  view = "intelligence",
}: {
  providerId: string;
  facilityId: string;
  facilityName: string;
  canEdit: boolean;
  contactAction: ContactPromotionAction;
  jobs: ResearchJob[];
  claims: IntelligenceClaim[];
  approvedFacts: CommercialFact[];
  researchAllowed: boolean;
  researchConfigured: boolean;
  freshnessPolicy: ResearchFreshnessPolicy;
  selected: boolean;
  view?: "intelligence" | "evidence";
}) {
  const facilityJobs = scopeJobs(jobs, facilityId);
  const lifecycle = researchLifecycle(facilityJobs, freshnessPolicy);
  const latestCompleted =
    facilityJobs.find(
      (job) => job.status === "completed" && job.model !== "operator-curated",
    ) ?? null;
  const visibleClaims = currentClaimsForScope(
    facilityJobs,
    claims,
    latestCompleted?.id ?? null,
  );
  const facilityFacts = approvedFacts.filter(
    (fact) => fact.facility_id === facilityId,
  );
  if (view === "evidence") {
    return (
      <section
        className="mt-5 rounded-[8px] border border-[#dce7e1] bg-white p-4"
        aria-label={`Evidence for ${facilityName}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Facility evidence</p>
            <h3 className="mt-1 text-sm font-semibold text-[#244136]">
              {facilityName}
            </h3>
          </div>
          <Badge tone="blue">{facilityJobs.length} runs</Badge>
        </div>
        {visibleClaims.length ? (
          <details className="mt-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-[#1f6548]">
              Current sources and findings
            </summary>
            <div className="mt-4">
              <BriefSections
                claims={visibleClaims}
                providerId={providerId}
                facilityId={facilityId}
                canEdit={canEdit}
                contactAction={contactAction}
                freshnessPolicy={freshnessPolicy}
                researchAllowed={researchAllowed}
                showEvidence
                returnTab="evidence"
              />
            </div>
          </details>
        ) : null}
        <ResearchHistory
          jobs={facilityJobs}
          currentJobId={latestCompleted?.id ?? null}
          claims={claims}
          providerId={providerId}
          facilityId={facilityId}
          canEdit={canEdit}
          contactAction={contactAction}
          freshnessPolicy={freshnessPolicy}
          returnTab="evidence"
        />
        <CommercialKnowledge facts={facilityFacts} label="Facility" />
      </section>
    );
  }
  return (
    <section
      className="mt-4 border-t border-[#dce7e1] pt-4"
      aria-label={`Facility intelligence for ${facilityName}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker">Web intelligence · Selected facility</p>
          <div className="mt-1">
            <ResearchStatus
              state={lifecycle.state}
              ageDays={lifecycle.ageDays}
              completedAt={latestCompleted?.completed_at ?? null}
              researchAllowed={researchAllowed}
            />
          </div>
          {latestCompleted ? (
            <p className="mt-2 text-xs text-[#64726c]">
              {latestCompleted.source_count} sources · {latestCompleted.claim_count}{" "}
              findings · {latestCompleted.people_count} people ·{" "}
              {latestCompleted.gap_count} gaps
            </p>
          ) : researchAllowed ? (
            <p className="mt-2 text-xs text-[#64726c]">
              Local leadership, context, public signals and visit preparation
              have not been researched.
            </p>
          ) : null}
        </div>
        {canEdit && researchAllowed ? (
          <ResearchAction
            providerId={providerId}
            facilityId={facilityId}
            state={lifecycle.state}
            hasCompleted={Boolean(latestCompleted)}
          />
        ) : null}
      </div>
      {researchAllowed && !researchConfigured ? (
        <p className="mt-3 text-xs font-semibold text-amber-800">
          Live research requires the server-only OpenAI key; no fallback facts
          will be fabricated.
        </p>
      ) : null}
      <ResearchRunNotice
        state={lifecycle.state}
        errorMessage={lifecycle.latestAttempt?.error_message}
        scope="facility"
      />
      {visibleClaims.length ? (
        <details className="mt-4" open={selected}>
          <summary className="cursor-pointer text-sm font-semibold text-[#1f6548]">
            {selected ? "Current facility brief" : "View current facility brief"}
          </summary>
          <div className="mt-4">
            <BriefSections
              claims={visibleClaims}
              providerId={providerId}
              facilityId={facilityId}
              canEdit={canEdit}
              contactAction={contactAction}
              freshnessPolicy={freshnessPolicy}
              researchAllowed={researchAllowed}
            />
          </div>
        </details>
      ) : null}
      {visibleClaims.length ? <CommercialFollowThrough /> : null}
      {!selected && latestCompleted ? (
        <Link
          href={`/providers/${providerId}?facility=${facilityId}#facility-${facilityId}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1f6548] hover:underline"
        >
          Open focused facility context <ArrowRight className="size-3" />
        </Link>
      ) : null}
    </section>
  );
}

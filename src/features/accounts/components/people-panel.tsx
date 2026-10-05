import { ExternalLink, Mail, Phone } from "lucide-react";
import { ContactForm } from "@/features/accounts/components/contact-form";
import type { PeopleTabData } from "@/features/accounts/server/load-provider-tabs";
import type { ProviderWorkspaceCore } from "@/features/accounts/server/load-provider-workspace-core";
import {
  proposeContactChange,
  reviewContactChange,
  saveContact,
} from "@/features/accounts/server/actions";
import { ResearchPeople } from "@/features/intelligence/components/research-people";
import { currentClaimsForScope } from "@/features/intelligence/lib/claims";
import { researchLifecycle, type ResearchFreshnessPolicy } from "@/features/intelligence/lib/freshness";
import {
  DisclosureForm,
  Field,
  SelectField,
  TextAreaField,
} from "@/shared/components/forms";
import { SubmitButton } from "@/shared/components/submit-button";
import { Badge, EmptyState, SectionTitle } from "@/shared/components/ui";
import { formatDate, initials } from "@/shared/lib/format";

type ContactRecord = PeopleTabData["contacts"][number];
type ContactProposal = PeopleTabData["contactChangeProposals"][number];

function proposalSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "Reverify current details";
  const summary = Object.entries(value)
    .map(([key, item]) => `${key.replaceAll("_", " ")}: ${String(item)}`)
    .join(" · ");
  return summary || "Reverify current details";
}

function ContactRow({
  contact,
  providerId,
  core,
  proposals,
  returnPath,
}: {
  contact: ContactRecord;
  providerId: string;
  core: ProviderWorkspaceCore;
  proposals: ContactProposal[];
  returnPath: string;
}) {
  const facility = core.facilities.find(
    (item) => item.id === contact.facility_id,
  );
  const lifecycle = contact as ContactRecord & { currentness_status?: string };
  const status = lifecycle.currentness_status ?? "current";
  return (
    <article
      id={`contact-${contact.id}`}
      className="scroll-mt-24 py-4 first:pt-0 last:pb-0"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#dff8ec] text-xs font-bold text-[#1f6548]">
            {initials(contact.full_name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-[#1f352c]">{contact.full_name}</h3>
              <Badge
                tone={
                  status === "current"
                    ? "green"
                    : status === "needs_review" || status === "unverified"
                      ? "amber"
                      : "slate"
                }
              >
                {status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-[#43574e]">
              {contact.title ?? "Role not recorded"}
            </p>
            <p className="mt-1 text-xs text-[#64726c]">
              {facility ? facility.name : "Provider-wide"}
              {contact.last_verified_at
                ? ` · Last verified ${formatDate(contact.last_verified_at)}`
                : " · Verification date not recorded"}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#64726c]">
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-center gap-1 hover:text-[#1f6548] hover:underline"
                >
                  <Mail className="size-3.5" /> {contact.email}
                </a>
              ) : null}
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex items-center gap-1 hover:text-[#1f6548] hover:underline"
                >
                  <Phone className="size-3.5" /> {contact.phone}
                </a>
              ) : null}
              {contact.professional_profile_url ? (
                <a
                  href={contact.professional_profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#1f6548] hover:underline"
                >
                  <ExternalLink className="size-3.5" /> Profile
                </a>
              ) : null}
              {contact.source_url ? (
                <a
                  href={contact.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#1f6548] hover:underline"
                >
                  Evidence <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
        {core.canEdit ? (
          <div className="flex flex-wrap gap-2">
            {contact.record_mode === "sandbox" ? (
              <DisclosureForm label="Edit contact">
                <ContactForm
                  providerId={providerId}
                  facilities={core.facilities}
                  contact={contact}
                  returnFacilityId={core.selectedFacilityId ?? undefined}
                  returnTab="people"
                  returnTo={returnPath}
                />
              </DisclosureForm>
            ) : null}
            {contact.record_mode === "real" ? (
              <DisclosureForm label="Review details">
                <form action={proposeContactChange} className="space-y-4">
                  <input type="hidden" name="provider_id" value={providerId} />
                  <input type="hidden" name="contact_id" value={contact.id} />
                  <input
                    type="hidden"
                    name="return_facility_id"
                    value={core.selectedFacilityId ?? ""}
                  />
                  <p className="text-sm leading-6 text-[#52635b]">
                    Record a sourced verification or proposed change. Current
                    contact details remain untouched until a separate approval.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Proposed full name" name="full_name" />
                    <SelectField label="Proposed scope" name="facility_id">
                      <option value="">Keep current scope</option>
                      {core.facilities.map((facilityOption) => (
                        <option key={facilityOption.id} value={facilityOption.id}>
                          {facilityOption.name}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Currentness"
                      name="currentness_status"
                      defaultValue={status}
                    >
                      <option value="current">Current</option>
                      <option value="needs_review">Needs review</option>
                      <option value="changed_role">Changed role</option>
                      <option value="left_organisation">Left organisation</option>
                      <option value="unverified">Unverified</option>
                    </SelectField>
                    <Field label="Observed" name="observed_at" type="date" />
                    <Field label="Proposed title" name="title" />
                    <Field label="Proposed email" name="email" type="email" />
                    <Field label="Proposed phone" name="phone" />
                    <Field
                      label="Proposed profile URL"
                      name="professional_profile_url"
                      type="url"
                    />
                    <Field
                      label="Source type"
                      name="source_type"
                      defaultValue="official_provider"
                    />
                    <Field label="Source URL" name="source_url" type="url" />
                  </div>
                  <TextAreaField label="Review note" name="proposal_note" />
                  <SubmitButton pendingLabel="Saving proposal…">
                    Save for review
                  </SubmitButton>
                </form>
              </DisclosureForm>
            ) : null}
          </div>
        ) : null}
      </div>
      {proposals.map((proposal) => (
        <div
          key={proposal.id}
          className="ml-0 mt-3 rounded-[7px] border border-amber-200 bg-amber-50 p-3 sm:ml-[52px]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-amber-950">
                  Pending contact change
                </p>
                <Badge tone="amber">Needs review</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                {proposalSummary(proposal.proposed_changes)}
              </p>
              {proposal.source_url ? (
                <a
                  href={proposal.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1f6548] hover:underline"
                >
                  Open evidence <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
            {core.canEdit ? (
              <DisclosureForm label="Review change">
                <form action={reviewContactChange} className="space-y-4">
                  <input type="hidden" name="provider_id" value={providerId} />
                  <input type="hidden" name="contact_id" value={contact.id} />
                  <input type="hidden" name="proposal_id" value={proposal.id} />
                  <input
                    type="hidden"
                    name="return_facility_id"
                    value={core.selectedFacilityId ?? ""}
                  />
                  <p className="text-sm leading-6 text-[#52635b]">
                    Approve applies the proposed details to this same contact
                    identity. Reject leaves the contact unchanged. Either
                    decision remains in the audit history.
                  </p>
                  <SelectField label="Decision" name="review_action" required>
                    <option value="approve">Approve change</option>
                    <option value="reject">Reject change</option>
                  </SelectField>
                  <TextAreaField label="Review note" name="review_note" />
                  <SubmitButton pendingLabel="Recording review…">
                    Record decision
                  </SubmitButton>
                </form>
              </DisclosureForm>
            ) : null}
          </div>
        </div>
      ))}
    </article>
  );
}

export function PeoplePanel({
  core,
  data,
  providerId,
  returnPath,
  freshnessPolicy,
}: {
  core: ProviderWorkspaceCore;
  data: PeopleTabData;
  providerId: string;
  returnPath: string;
  freshnessPolicy: ResearchFreshnessPolicy;
}) {
  const providerJobs = data.researchJobs.filter((job) => job.facility_id === null);
  const providerLifecycle = researchLifecycle(providerJobs, freshnessPolicy);
  const providerClaims = currentClaimsForScope(
    providerJobs,
    data.intelligenceClaims,
    providerLifecycle.latestCompleted?.id ?? null,
  );
  const facilityJobs = core.selectedFacilityId
    ? data.researchJobs.filter(
        (job) => job.facility_id === core.selectedFacilityId,
      )
    : [];
  const facilityLifecycle = researchLifecycle(facilityJobs, freshnessPolicy);
  const facilityClaims = currentClaimsForScope(
    facilityJobs,
    data.intelligenceClaims,
    facilityLifecycle.latestCompleted?.id ?? null,
  );

  return (
    <div className="space-y-5">
      <section id="contacts" className="card scroll-mt-24">
        <div className="panel-header">
          <SectionTitle
            title="CRM contacts"
            description={core.provider.is_sample
              ? "People recorded directly against this account."
              : "Durable people records. Research never deletes or silently overwrites these contacts."}
          />
          {core.canEdit ? (
            <DisclosureForm label="Add contact">
              <ContactForm
                providerId={providerId}
                facilities={core.facilities}
                defaultFacilityId={core.selectedFacilityId ?? undefined}
                returnTab="people"
                returnTo={returnPath}
              />
            </DisclosureForm>
          ) : null}
        </div>
        {data.contacts.length ? (
          <div className="divide-y divide-[#e7edea] px-4">
            {data.contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                providerId={providerId}
                core={core}
                proposals={data.contactChangeProposals.filter(
                  (proposal) =>
                    proposal.contact_id === contact.id &&
                    proposal.status === "pending",
                )}
                returnPath={returnPath}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No CRM contacts"
            description={core.provider.is_sample
              ? "Add known professional information to this account."
              : "Add only known professional information and retain its source."}
          />
        )}
      </section>
      {!core.provider.is_sample ? <section className="card">
        <div className="panel-header">
          <SectionTitle
            title="Researched people"
            description="Publicly sourced candidates remain separate until a human adds them as CRM contacts."
          />
          <Badge tone="blue">Web intelligence</Badge>
        </div>
        <div className="p-4">
          <ResearchPeople
            providerClaims={providerClaims}
            facilityClaims={facilityClaims}
            providerId={providerId}
            facilityId={core.selectedFacilityId}
            canEdit={core.canEdit}
            contactAction={saveContact}
          />
        </div>
      </section> : null}
    </div>
  );
}

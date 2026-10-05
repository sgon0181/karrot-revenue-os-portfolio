import { Check, UserPlus, X } from "lucide-react";
import { reviewIntelligenceClaim } from "@/features/intelligence/server/actions";
import { sourceList } from "@/features/intelligence/lib/claims";
import { linkedInPersonProfileFromSources } from "@/features/intelligence/lib/linkedin-profile";
import type {
  IntelligenceClaim,
  IntelligenceReturnTab,
  ContactPromotionAction,
} from "@/features/intelligence/lib/types";
import {
  DisclosureForm,
  Field,
  TextAreaField,
} from "@/shared/components/forms";
import { SubmitButton } from "@/shared/components/submit-button";
import { Badge } from "@/shared/components/ui";

export function ClaimReviewControls({
  claim,
  providerId,
  facilityId,
  returnFacilityId,
  returnTab = "intelligence",
}: {
  claim: IntelligenceClaim;
  providerId: string;
  facilityId: string | null;
  returnFacilityId?: string | null;
  returnTab?: IntelligenceReturnTab;
}) {
  if (claim.review_status !== "pending") {
    return (
      <Badge tone={claim.review_status === "rejected" ? "red" : "green"}>
        {claim.review_status}
      </Badge>
    );
  }

  const canPromote = claim.epistemic_state === "known";
  return (
    <div className="max-w-sm">
      <div className="flex flex-wrap items-center gap-2">
        {canPromote ? (
          <>
            <form action={reviewIntelligenceClaim}>
              <input type="hidden" name="provider_id" value={providerId} />
              <input type="hidden" name="facility_id" value={facilityId ?? ""} />
              <input
                type="hidden"
                name="return_facility_id"
                value={returnFacilityId ?? ""}
              />
              <input type="hidden" name="return_tab" value={returnTab} />
              <input type="hidden" name="claim_id" value={claim.id} />
              <input type="hidden" name="review_action" value="approved" />
              <SubmitButton
                className="button-secondary !px-2.5 !py-1.5 !text-xs"
                pendingLabel="Approving…"
              >
                <Check className="size-3.5" />
                Approve
              </SubmitButton>
            </form>
            <DisclosureForm label="Correct">
              <form action={reviewIntelligenceClaim} className="space-y-4">
                <input type="hidden" name="provider_id" value={providerId} />
                <input type="hidden" name="facility_id" value={facilityId ?? ""} />
                <input
                  type="hidden"
                  name="return_facility_id"
                  value={returnFacilityId ?? ""}
                />
                <input type="hidden" name="return_tab" value={returnTab} />
                <input type="hidden" name="claim_id" value={claim.id} />
                <input type="hidden" name="review_action" value="corrected" />
                <TextAreaField
                  label="Corrected statement"
                  name="corrected_statement"
                  defaultValue={claim.statement}
                />
                <TextAreaField
                  label="Review note"
                  name="review_note"
                  placeholder="Why was this correction required?"
                />
                <SubmitButton pendingLabel="Recording correction…">
                  Approve correction
                </SubmitButton>
              </form>
            </DisclosureForm>
          </>
        ) : (
          <Badge tone="slate">Keep as a question</Badge>
        )}
        <form action={reviewIntelligenceClaim}>
          <input type="hidden" name="provider_id" value={providerId} />
          <input type="hidden" name="facility_id" value={facilityId ?? ""} />
          <input
            type="hidden"
            name="return_facility_id"
            value={returnFacilityId ?? ""}
          />
          <input type="hidden" name="return_tab" value={returnTab} />
          <input type="hidden" name="claim_id" value={claim.id} />
          <input type="hidden" name="review_action" value="rejected" />
          <SubmitButton
            className="button-secondary !px-2.5 !py-1.5 !text-xs"
            pendingLabel="Rejecting…"
          >
            <X className="size-3.5" />
            Reject
          </SubmitButton>
        </form>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#64726c]">
        {canPromote
          ? "Approve adds this to commercial knowledge. Correct edits and approves. Reject keeps the audit record but excludes it from approved knowledge."
          : "Hypotheses and gaps cannot become approved knowledge. Reject only when this item should be removed from the working brief."}
      </p>
    </div>
  );
}

export function ContactFromClaim({
  claim,
  providerId,
  facilityId,
  contactAction,
  returnFacilityId,
  returnTab = "intelligence",
}: {
  claim: IntelligenceClaim;
  providerId: string;
  facilityId: string | null;
  contactAction: ContactPromotionAction;
  returnFacilityId?: string | null;
  returnTab?: IntelligenceReturnTab;
}) {
  const sources = sourceList(claim);
  if (
    claim.category !== "person" ||
    claim.epistemic_state !== "known" ||
    !claim.person_name ||
    !sources.length
  )
    return null;
  const source = sources[0];
  const linkedInProfileUrl = linkedInPersonProfileFromSources(sources);
  return (
    <DisclosureForm label="Add as contact">
      <form action={contactAction} className="space-y-4">
        <input type="hidden" name="provider_id" value={providerId} />
        <input type="hidden" name="facility_id" value={facilityId ?? ""} />
        <input
          type="hidden"
          name="return_facility_id"
          value={returnFacilityId ?? facilityId ?? ""}
        />
        <input type="hidden" name="return_tab" value={returnTab} />
        <input type="hidden" name="record_mode" value="real" />
        <input
          type="hidden"
          name="role_category"
          value="Potentially relevant stakeholder"
        />
        <input type="hidden" name="relationship_status" value="Researching" />
        <input
          type="hidden"
          name="source_type"
          value="Evidence-backed public research"
        />
        <input type="hidden" name="source_url" value={source.url} />
        {linkedInProfileUrl ? (
          <input
            type="hidden"
            name="professional_profile_url"
            value={linkedInProfileUrl}
          />
        ) : null}
        <input
          type="hidden"
          name="last_verified_at"
          value={claim.observed_at ?? ""}
        />
        <p className="text-sm leading-6 text-[#52635b]">
          Create a sourced professional contact without assuming buying
          authority. No email address will be generated.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            name="full_name"
            defaultValue={claim.person_name}
            required
          />
          <Field label="Title" name="title" defaultValue={claim.person_title} />
        </div>
        <TextAreaField
          label="Notes"
          name="notes"
          defaultValue={claim.potential_relevance}
        />
        <SubmitButton pendingLabel="Adding contact…">
          <UserPlus className="size-4" />
          Add sourced contact
        </SubmitButton>
      </form>
    </DisclosureForm>
  );
}

"use client";

import { useState } from "react";
import { Field, SelectField, TextAreaField } from "@/shared/components/forms";
import { InternalReturnToInput } from "@/shared/components/internal-return-to-input";
import { SubmitButton } from "@/shared/components/submit-button";
import { stageTransitionGuidance, type StageOutcome } from "@/features/commercial/lib/commercial";
import {
  createNextAction,
  createOpportunity,
  logActivity,
  updateOpportunityStage,
} from "@/features/accounts/server/actions";

type Option = { id: string; name: string };
type ContactOption = { id: string; full_name: string };
type StageOption = { id: string; name: string; outcome?: string | null };
type OpportunityOption = { id: string; name: string };

export function OpportunityForm({
  providerId,
  stages,
  contacts,
  defaultContext,
  returnTo,
}: {
  providerId: string;
  stages: StageOption[];
  contacts: ContactOption[];
  defaultContext?: string;
  returnTo?: string;
}) {
  const initialStages = stages.filter((stage) => !stage.outcome);

  return (
    <form action={createOpportunity} className="space-y-4">
      <input type="hidden" name="provider_id" value={providerId} />
      {returnTo ? <InternalReturnToInput returnTo={returnTo} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Opportunity name" name="name" required defaultValue={defaultContext ? `${defaultContext} — initial commercial opportunity` : undefined} placeholder="Initial pilot" />
        <SelectField label="Initial stage" name="stage_id" required>
          {initialStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </SelectField>
        <SelectField label="Primary contact" name="primary_contact_id">
          <option value="">Not assigned</option>
          {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
        </SelectField>
        <Field label="Expected close" name="expected_close_date" type="date" />
        <Field label="Estimated value (AUD)" name="estimated_value" type="number" />
        <Field label="Estimated beds" name="estimated_beds" type="number" />
      </div>
      <TextAreaField label="Commercial context" name="notes" defaultValue={defaultContext ? `Facility context: ${defaultContext}` : undefined} placeholder="What is this motion trying to achieve?" />
      <SubmitButton pendingLabel="Creating opportunity…">Create opportunity</SubmitButton>
    </form>
  );
}

export function OpportunityStageForm({
  opportunityId,
  providerId,
  stages,
  currentStageId,
  currentOutcome,
  closedLostReason,
  hasCustomer,
  returnTo,
}: {
  opportunityId: string;
  providerId: string;
  stages: StageOption[];
  currentStageId: string;
  currentOutcome?: string | null;
  closedLostReason?: string | null;
  hasCustomer: boolean;
  returnTo: string;
}) {
  const [stageId, setStageId] = useState(currentStageId);
  const selectedStage = stages.find((stage) => stage.id === stageId);
  const selectedOutcome = (selectedStage?.outcome ?? null) as StageOutcome;
  const guidance = stageTransitionGuidance({
    selectedOutcome,
    currentOutcome: (currentOutcome ?? null) as StageOutcome,
    hasCustomer,
  });
  const isLost = guidance.requiresLossReason;

  return (
    <form action={updateOpportunityStage} className="border-t border-[#e7edea] bg-[#f7faf8] p-4">
      <input type="hidden" name="provider_id" value={providerId} />
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <InternalReturnToInput returnTo={returnTo} />
      <div className={`grid gap-3 ${isLost ? "sm:grid-cols-[1fr_1fr_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
        <label className="block">
          <span className="label">Move stage<span className="ml-0.5 text-[#d73b4b]" aria-hidden="true">*</span></span>
          <select className="input" name="stage_id" value={stageId} onChange={(event) => setStageId(event.target.value)} required>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </label>
        {isLost ? (
          <label className="block">
            <span className="label">Why was this opportunity lost?<span className="ml-0.5 text-[#d73b4b]" aria-hidden="true">*</span></span>
            <input className="input" name="closed_lost_reason" defaultValue={currentOutcome === "lost" ? closedLostReason ?? "" : ""} required />
          </label>
        ) : null}
        <div className="self-end"><SubmitButton pendingLabel="Moving…">Update stage</SubmitButton></div>
      </div>
      {guidance.message ? (
        <p className={`mt-3 rounded-[6px] border px-3 py-2 text-xs leading-5 ${guidance.tone === "won" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : guidance.tone === "lost" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
          {guidance.message}
        </p>
      ) : null}
    </form>
  );
}

export function ActivityForm({
  providerId,
  opportunities,
  contacts,
  facilities,
  defaultOpportunityId,
  defaultFacilityId,
  returnFacilityId,
  returnTo,
}: {
  providerId: string;
  opportunities: OpportunityOption[];
  contacts: ContactOption[];
  facilities: Option[];
  defaultOpportunityId?: string;
  defaultFacilityId?: string;
  returnFacilityId?: string;
  returnTo?: string;
}) {
  return (
    <form action={logActivity} className="space-y-4">
      <input type="hidden" name="provider_id" value={providerId} />
      {returnFacilityId ? <input type="hidden" name="return_facility_id" value={returnFacilityId} /> : null}
      {returnTo ? <InternalReturnToInput returnTo={returnTo} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" name="activity_type" required>
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="email">Email</option>
          <option value="note">Note</option>
          <option value="follow_up">Follow-up</option>
          <option value="site_visit">Site visit</option>
          <option value="other">Other</option>
        </SelectField>
        <Field label="Occurred (Sydney time)" name="occurred_at" type="datetime-local" />
        <Field label="What happened?" name="subject" required />
        <SelectField label="Opportunity" name="opportunity_id" defaultValue={defaultOpportunityId}>
          <option value="">Provider-level</option>
          {opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.name}</option>)}
        </SelectField>
        <SelectField label="Contact" name="contact_id">
          <option value="">Not linked</option>
          {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
        </SelectField>
        <SelectField label="Facility" name="facility_id" defaultValue={defaultFacilityId}>
          <option value="">Not linked</option>
          {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
        </SelectField>
      </div>
      <TextAreaField label="Outcome / notes" name="notes" />
      <SubmitButton pendingLabel="Logging activity…">Log activity</SubmitButton>
    </form>
  );
}

export function NextActionForm({
  providerId,
  opportunities,
  contacts,
  defaultOpportunityId,
  defaultContext,
  returnFacilityId,
  returnTo,
}: {
  providerId: string;
  opportunities: OpportunityOption[];
  contacts: ContactOption[];
  defaultOpportunityId?: string;
  defaultContext?: string;
  returnFacilityId?: string;
  returnTo?: string;
}) {
  return (
    <form action={createNextAction} className="space-y-4">
      <input type="hidden" name="provider_id" value={providerId} />
      {returnFacilityId ? <input type="hidden" name="return_facility_id" value={returnFacilityId} /> : null}
      {returnTo ? <InternalReturnToInput returnTo={returnTo} /> : null}
      <Field label="What happens next?" name="title" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due (Sydney time)" name="due_at" type="datetime-local" />
        <SelectField label="Priority" name="priority" defaultValue="normal">
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </SelectField>
        <SelectField label="Opportunity" name="opportunity_id" defaultValue={defaultOpportunityId}>
          <option value="">Provider-level</option>
          {opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.name}</option>)}
        </SelectField>
        <SelectField label="Contact" name="contact_id">
          <option value="">Not linked</option>
          {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
        </SelectField>
      </div>
      <TextAreaField label="Notes" name="notes" defaultValue={defaultContext ? `Facility context: ${defaultContext}` : undefined} />
      <SubmitButton pendingLabel="Adding action…">Set next action</SubmitButton>
    </form>
  );
}

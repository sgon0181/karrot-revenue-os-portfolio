import Link from "next/link";
import { Check, Clock3 } from "lucide-react";
import type { CommercialTabData } from "@/features/accounts/server/load-provider-tabs";
import type { ProviderWorkspaceCore } from "@/features/accounts/server/load-provider-workspace-core";
import {
  addCustomerFacility,
  completeNextAction,
  updateCustomer,
} from "@/features/accounts/server/actions";
import {
  ActivityForm,
  NextActionForm,
  OpportunityForm,
} from "@/features/commercial/components/commercial-forms";
import {
  DisclosureForm,
  Field,
  SelectField,
  TextAreaField,
} from "@/shared/components/forms";
import { InternalReturnToInput } from "@/shared/components/internal-return-to-input";
import { SubmitButton } from "@/shared/components/submit-button";
import { Badge, EmptyState, SectionTitle } from "@/shared/components/ui";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { withInheritedHash, withReturnTo } from "@/shared/lib/internal-navigation";

export function CommercialPanel({
  core,
  data,
  providerId,
  returnPath,
}: {
  core: ProviderWorkspaceCore;
  data: CommercialTabData;
  providerId: string;
  returnPath: string;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-5">
        <section id="opportunities" className="card scroll-mt-24">
          <div className="panel-header">
            <SectionTitle
              title="Opportunities"
              description="Separate commercial motions with their own stages and history."
            />
            {core.canEdit ? (
              <DisclosureForm label="New opportunity">
                <OpportunityForm
                  providerId={providerId}
                  stages={data.stages}
                  contacts={data.contacts}
                  defaultContext={core.selectedFacility?.name}
                  returnTo={returnPath}
                />
              </DisclosureForm>
            ) : null}
          </div>
          {data.opportunities.length ? (
            <div className="space-y-3 p-4">
              {data.opportunities.map((opportunity) => (
                <article
                  key={opportunity.id}
                  className="rounded-[8px] border border-[#dce6e1] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={withReturnTo(
                          `/opportunities/${opportunity.id}`,
                          withInheritedHash(returnPath, "#opportunities"),
                        )}
                        className="font-semibold text-[#1f352c] hover:text-[#1f6548] hover:underline"
                      >
                        {opportunity.name}
                      </Link>
                      <p className="mt-1 text-xs text-[#64726c]">
                        Entered {formatDate(opportunity.stage_entered_at)} ·{" "}
                        {formatCurrency(opportunity.estimated_value)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        opportunity.pipeline_stages?.outcome === "won"
                          ? "green"
                          : opportunity.pipeline_stages?.outcome === "lost"
                            ? "red"
                            : "blue"
                      }
                    >
                      {opportunity.pipeline_stages?.name}
                    </Badge>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No opportunities"
              description="Create an opportunity when a distinct commercial motion begins."
            />
          )}
        </section>
        <CustomerPanel
          core={core}
          data={data}
          providerId={providerId}
          returnPath={returnPath}
        />
      </div>
      <aside className="space-y-5">
        <section id="next-actions" className="card scroll-mt-24">
          <div className="panel-header">
            <SectionTitle
              title="Next actions"
              description="What must happen next and when."
            />
            {core.canEdit ? (
              <DisclosureForm label="Set next action">
                <NextActionForm
                  providerId={providerId}
                  opportunities={data.opportunities}
                  contacts={data.contacts}
                  defaultContext={core.selectedFacility?.name}
                  returnFacilityId={core.selectedFacilityId ?? undefined}
                  returnTo={returnPath}
                />
              </DisclosureForm>
            ) : null}
          </div>
          {data.actions.length ? (
            <div className="space-y-3 p-4">
              {data.actions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-[7px] border border-[#dce6e1] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className={
                          action.status === "completed"
                            ? "text-sm text-[#64726c] line-through"
                            : "text-sm font-semibold text-[#2c4037]"
                        }
                      >
                        {action.title}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#64726c]">
                        <Clock3 className="size-3.5" />
                        {formatDate(action.due_at, true)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        action.status === "completed"
                          ? "green"
                          : action.priority === "high"
                            ? "red"
                            : "slate"
                      }
                    >
                      {action.status}
                    </Badge>
                  </div>
                  {action.status === "open" && core.canEdit ? (
                    <form action={completeNextAction} className="mt-3">
                      <input type="hidden" name="provider_id" value={providerId} />
                      <input type="hidden" name="action_id" value={action.id} />
                      <InternalReturnToInput returnTo={returnPath} />
                      <SubmitButton
                        className="button-tertiary min-h-8 px-0 py-1 text-xs"
                        pendingLabel="Completing…"
                      >
                        <Check className="size-3.5" /> Mark complete
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No next actions"
              description="Every active opportunity should have a clear next step."
            />
          )}
        </section>
        <section id="activity" className="card scroll-mt-24">
          <div className="panel-header">
            <SectionTitle
              title="Activity history"
              description="Most recent commercial interaction first."
            />
            {core.canEdit ? (
              <DisclosureForm label="Log activity">
                <ActivityForm
                  providerId={providerId}
                  opportunities={data.opportunities}
                  contacts={data.contacts}
                  facilities={core.facilities}
                  defaultFacilityId={core.selectedFacilityId ?? undefined}
                  returnFacilityId={core.selectedFacilityId ?? undefined}
                  returnTo={returnPath}
                />
              </DisclosureForm>
            ) : null}
          </div>
          {data.activities.length ? (
            <div className="relative m-4 border-l border-dashed border-[#a9c9ba] pl-5">
              {data.activities.map((activity) => (
                <div key={activity.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[26px] top-1 size-3 rounded-full border-2 border-white bg-[#14ae5c] ring-1 ring-[#9bd9b9]" />
                  <p className="text-sm font-semibold text-[#2c4037]">
                    {activity.subject}
                  </p>
                  <p className="mt-1 text-xs text-[#64726c]">
                    {formatDate(activity.occurred_at, true)} ·{" "}
                    {activity.activity_type}
                  </p>
                  {activity.notes ? (
                    <p className="mt-2 text-sm leading-6 text-[#52635b]">
                      {activity.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No activity recorded"
              description="Calls, emails, meetings, notes and visits appear here."
            />
          )}
        </section>
      </aside>
    </div>
  );
}

function CustomerPanel({
  core,
  data,
  providerId,
  returnPath,
}: {
  core: ProviderWorkspaceCore;
  data: CommercialTabData;
  providerId: string;
  returnPath: string;
}) {
  const linkedFacilityIds = new Set(
    data.customerFacilities.map((item) => item.facility_id),
  );
  const availableFacilities = core.facilities.filter(
    (facility) => !linkedFacilityIds.has(facility.id),
  );
  return (
    <section id="customer" className="card scroll-mt-24">
      <div className="panel-header">
        <SectionTitle
          title="Customer relationship"
          description="Closed-won continues into onboarding, live service, renewal and expansion."
        />
        {data.customer ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                data.customer.status === "active"
                  ? "green"
                  : data.customer.status === "churned"
                    ? "red"
                    : "slate"
              }
            >
              {data.customer.status}
            </Badge>
          </div>
        ) : (
          <Badge>Not a customer</Badge>
        )}
      </div>
      {data.customer ? (
        <>
          <form action={updateCustomer} className="space-y-4 p-4">
            <input type="hidden" name="provider_id" value={providerId} />
            <input type="hidden" name="customer_id" value={data.customer.id} />
            <InternalReturnToInput returnTo={returnPath} />
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Status"
                name="status"
                defaultValue={data.customer.status}
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="churned">Churned</option>
              </SelectField>
              <Field
                label="Onboarding state"
                name="onboarding_state"
                defaultValue={data.customer.onboarding_state ?? undefined}
              />
              <Field
                label="Customer since"
                name="customer_since"
                type="date"
                defaultValue={data.customer.customer_since ?? undefined}
              />
              <Field
                label="Contract start"
                name="contract_start_date"
                type="date"
                defaultValue={data.customer.contract_start_date ?? undefined}
              />
              <Field
                label="Contract end"
                name="contract_end_date"
                type="date"
                defaultValue={data.customer.contract_end_date ?? undefined}
              />
              <Field
                label="Renewal date"
                name="renewal_date"
                type="date"
                defaultValue={data.customer.renewal_date ?? undefined}
              />
            </div>
            <TextAreaField
              label="Notes"
              name="notes"
              defaultValue={data.customer.notes}
            />
            {core.canEdit ? (
              <SubmitButton pendingLabel="Saving customer…">
                Save customer
              </SubmitButton>
            ) : null}
          </form>
          <div className="border-t border-[#e7edea] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#244136]">
                Contracted facilities
              </h3>
              {availableFacilities.length && core.canEdit ? (
                <DisclosureForm label="Add facility">
                  <form action={addCustomerFacility} className="space-y-4">
                    <input type="hidden" name="provider_id" value={providerId} />
                    <input
                      type="hidden"
                      name="customer_id"
                      value={data.customer.id}
                    />
                    <InternalReturnToInput returnTo={returnPath} />
                    <SelectField label="Facility" name="facility_id" required>
                      {availableFacilities.map((facility) => (
                        <option key={facility.id} value={facility.id}>
                          {facility.name}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField label="Status" name="status" required>
                      <option value="contracted">Contracted</option>
                      <option value="onboarding">Onboarding</option>
                      <option value="live">Live</option>
                    </SelectField>
                    <SubmitButton pendingLabel="Saving facility…">
                      Save facility
                    </SubmitButton>
                  </form>
                </DisclosureForm>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {data.customerFacilities.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-[6px] bg-[#f7faf8] px-3 py-2"
                >
                  <p className="text-sm font-semibold">{item.facilities?.name}</p>
                  <Badge tone={item.status === "live" ? "green" : "slate"}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="Not a customer"
          description="Customer lifecycle tracking begins after a Closed Won opportunity."
        />
      )}
    </section>
  );
}

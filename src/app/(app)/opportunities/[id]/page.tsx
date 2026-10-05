import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  Clock3,
  ContactRound,
  ExternalLink,
  MessageSquareText,
  RotateCcw,
  Target,
  TriangleAlert,
  UserRound,
  Workflow,
} from "lucide-react";
import {
  completeNextAction,
  rescheduleNextAction,
  updateOpportunity,
} from "@/features/accounts/server/actions";
import { ActivityForm, NextActionForm, OpportunityStageForm } from "@/features/commercial/components/commercial-forms";
import { CommercialErrorToast } from "@/features/commercial/components/commercial-error-toast";
import { DisclosureForm, Field, SelectField, TextAreaField } from "@/shared/components/forms";
import { PageHeader } from "@/shared/components/page-header";
import { SubmitButton } from "@/shared/components/submit-button";
import { SuccessToast } from "@/shared/components/success-toast";
import { Badge, EmptyState, SectionTitle } from "@/shared/components/ui";
import { humanise, sydneyDateTimeLocalValue } from "@/features/commercial/lib/commercial";
import { formatCurrency, formatDate, formatNumber } from "@/shared/lib/format";
import { googleMapsLocationUrl } from "@/features/market/lib/maps";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";
import { ContextBreadcrumbs } from "@/shared/components/context-breadcrumbs";
import { InternalReturnToInput } from "@/shared/components/internal-return-to-input";
import { withReturnTo } from "@/shared/lib/internal-navigation";

function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function contextValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Unknown";
  return String(value);
}

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; alert?: string; returnTo?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { notice, alert } = query;
  const returnTo = typeof query.returnTo === "string" ? query.returnTo : null;
  const currentOpportunityPath = withReturnTo(`/opportunities/${id}`, returnTo);
  const supabase = await createClient();
  const [principal, opportunityResult] = await Promise.all([
    getAuthenticatedPrincipal(),
    supabase
      .from("opportunities")
      .select("*, providers(id, business_name, entity_name, abn, is_sample), pipeline_stages(*)")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (opportunityResult.error) throw new Error(opportunityResult.error.message);
  const opportunity = opportunityResult.data;
  if (!opportunity) notFound();
  const expectedMode = opportunity.providers?.is_sample ? "sandbox" : "real";
  if (opportunity.record_mode !== expectedMode) notFound();

  const [stagesResult, contactsResult, facilitiesResult, activitiesResult, actionsResult, historyResult, customerResult, ownerResult] = await Promise.all([
    supabase.from("pipeline_stages").select("*").eq("is_active", true).order("position"),
    supabase.from("contacts").select("*").eq("provider_id", opportunity.provider_id).order("full_name"),
    supabase.from("v_facility_latest").select("*").eq("provider_id", opportunity.provider_id).order("name"),
    supabase.from("activities").select("*, contacts(full_name), facilities(name)").eq("opportunity_id", id).order("occurred_at", { ascending: false }),
    supabase.from("next_actions").select("*, contacts(full_name)").eq("opportunity_id", id).order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("opportunity_stage_history").select("*").eq("opportunity_id", id).order("entered_at", { ascending: false }),
    supabase.from("customer_relationships").select("*").eq("provider_id", opportunity.provider_id).eq("record_mode", opportunity.record_mode).maybeSingle(),
    opportunity.owner_id
      ? supabase.from("profiles").select("display_name").eq("id", opportunity.owner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const result of [stagesResult, contactsResult, facilitiesResult, activitiesResult, actionsResult, historyResult, customerResult, ownerResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const canEdit = principal.role === "owner" || principal.role === "editor";
  const stages = stagesResult.data ?? [];
  const contacts = contactsResult.data ?? [];
  const eligibleContacts = contacts.filter((contact) => contact.record_mode === opportunity.record_mode);
  const facilities = (facilitiesResult.data ?? []).filter(
    (facility): facility is typeof facility & { id: string; name: string; full_address: string } =>
      Boolean(facility.id && facility.name && facility.full_address),
  );
  const activities = activitiesResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const openActions = actions.filter((action) => action.status === "open");
  const nextAction = openActions[0];
  const history = historyResult.data ?? [];
  const customer = customerResult.data;
  const currentStage = opportunity.pipeline_stages;
  const currentIndex = stages.findIndex((stage) => stage.id === opportunity.stage_id);
  const lastActivity = activities[0];
  const opportunityOptions = [{ id: opportunity.id, name: opportunity.name, record_mode: opportunity.record_mode }];
  const commercialContext: Array<[
    string,
    string | number | null | undefined,
    React.ComponentType<{ className?: string }>,
  ]> = [
    ["Problem", opportunity.problem_statement, Target],
    ["Why now", opportunity.why_now, CalendarClock],
    ["Champion", opportunity.champion_notes, UserRound],
    ["Decision process", opportunity.decision_process, Workflow],
    ["Blockers", opportunity.blockers, TriangleAlert],
    ["Additional notes", opportunity.notes, MessageSquareText],
  ];
  if (opportunity.closed_lost_reason) {
    commercialContext.unshift(["Closed Lost reason", opportunity.closed_lost_reason, TriangleAlert]);
  }

  return (
    <div>
      {notice ? <SuccessToast message={notice} /> : null}
      {alert ? <CommercialErrorToast message={alert} /> : null}
      <ContextBreadcrumbs
        currentLabel={opportunity.name}
        returnTo={returnTo}
        fallbackHref={`/providers/${opportunity.provider_id}?tab=commercial`}
        fallbackLabel={opportunity.providers?.business_name ?? "Provider"}
      />
      <PageHeader
        eyebrow="Opportunity workspace"
        title={opportunity.name}
        description={`${opportunity.providers?.business_name} · ${currentStage?.name ?? "Stage unknown"}`}
        action={
          <Badge tone={currentStage?.outcome === "won" ? "green" : currentStage?.outcome === "lost" ? "red" : "blue"}>{currentStage?.name}</Badge>
        }
      />

      {!canEdit ? (
        <div className="mb-4 rounded-[7px] border border-[#cfded7] bg-[#f7faf8] px-4 py-3 text-sm text-[#43574e]">
          <span className="font-semibold text-[#1f4f3a]">View-only access.</span> Commercial controls are disabled.
        </div>
      ) : null}

      <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
        <section className="record-header mb-5 overflow-hidden rounded-[9px] border border-[#cfe0d8] bg-white shadow-[0_1px_3px_rgba(8,47,35,0.06)]">
          <div className="grid gap-px bg-[#dce6e1] sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-white p-4"><p className="section-kicker">Current stage</p><p className="mt-2 text-lg font-semibold text-[#183128]">{currentStage?.name ?? "Unknown"}</p><p className="mt-1 text-xs text-[#64726c]">{formatNumber(daysSince(opportunity.stage_entered_at))} days in stage</p></div>
            <div className="bg-white p-4"><p className="section-kicker">Primary contact</p><p className="mt-2 text-sm font-semibold text-[#183128]">{contacts.find((contact) => contact.id === opportunity.primary_contact_id)?.full_name ?? "Not assigned"}</p><p className="mt-1 text-xs text-[#64726c]">{contacts.find((contact) => contact.id === opportunity.primary_contact_id)?.title ?? "No title recorded"}</p></div>
            <div className="bg-white p-4"><p className="section-kicker">Last activity</p><p className="mt-2 text-sm font-semibold text-[#183128]">{lastActivity?.subject ?? "No activity recorded"}</p><p className="mt-1 text-xs text-[#64726c]">{formatDate(lastActivity?.occurred_at, true)}</p></div>
            <div className="bg-white p-4"><p className="section-kicker">Next action</p><p className="mt-2 text-sm font-semibold text-[#183128]">{nextAction?.title ?? "No next action"}</p><p className={`mt-1 text-xs ${nextAction?.due_at && new Date(nextAction.due_at) < new Date() ? "font-semibold text-[#c53141]" : "text-[#64726c]"}`}>{formatDate(nextAction?.due_at, true)}</p></div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[#dce6e1] bg-[#f7faf8] px-4 py-3">
            <DisclosureForm label="Log activity"><ActivityForm providerId={opportunity.provider_id} opportunities={opportunityOptions} contacts={eligibleContacts} facilities={facilities} defaultOpportunityId={id} returnTo={currentOpportunityPath} /></DisclosureForm>
            <DisclosureForm label="Set next action"><NextActionForm providerId={opportunity.provider_id} opportunities={opportunityOptions} contacts={eligibleContacts} defaultOpportunityId={id} returnTo={currentOpportunityPath} /></DisclosureForm>
            <DisclosureForm label="Edit opportunity">
              <form action={updateOpportunity} className="space-y-4">
                <input type="hidden" name="provider_id" value={opportunity.provider_id} />
                <input type="hidden" name="opportunity_id" value={id} />
                <InternalReturnToInput returnTo={currentOpportunityPath} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Opportunity name" name="name" defaultValue={opportunity.name} required />
                  <SelectField label="Primary contact" name="primary_contact_id" defaultValue={opportunity.primary_contact_id}>
                    <option value="">Not assigned</option>
                    {eligibleContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
                  </SelectField>
                  <Field label="Expected close" name="expected_close_date" type="date" defaultValue={opportunity.expected_close_date} />
                  <Field label="Estimated value (AUD)" name="estimated_value" type="number" defaultValue={opportunity.estimated_value} />
                  <Field label="Estimated beds" name="estimated_beds" type="number" defaultValue={opportunity.estimated_beds} />
                </div>
                <TextAreaField label="Problem" name="problem_statement" defaultValue={opportunity.problem_statement} />
                <TextAreaField label="Why now" name="why_now" defaultValue={opportunity.why_now} />
                <TextAreaField label="Champion" name="champion_notes" defaultValue={opportunity.champion_notes} />
                <TextAreaField label="Decision process" name="decision_process" defaultValue={opportunity.decision_process} />
                <TextAreaField label="Blockers" name="blockers" defaultValue={opportunity.blockers} />
                <TextAreaField label="Additional notes" name="notes" defaultValue={opportunity.notes} />
                <SubmitButton pendingLabel="Saving…">Save opportunity</SubmitButton>
              </form>
            </DisclosureForm>
          </div>
        </section>

        <section className="card mb-5 overflow-hidden" aria-labelledby="stage-progress-heading">
          <div className="panel-header"><SectionTitle title="Stage progression" description="Movement is recorded in immutable stage history." /></div>
          <div className="overflow-x-auto p-4 sm:p-5">
            <ol className="flex min-w-[850px] items-start" id="stage-progress-heading">
              {stages.map((stage, index) => {
                const active = stage.id === opportunity.stage_id;
                const complete = currentIndex >= 0 && index < currentIndex;
                return (
                  <li key={stage.id} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
                    {index ? <span className={`absolute right-1/2 top-3 h-0.5 w-full ${complete || active ? "bg-[#2f7a58]" : "bg-[#dce6e1]"}`} /> : null}
                    <span className={`relative z-10 grid size-6 place-items-center rounded-full border-2 ${active ? "border-[#ff8059] bg-white ring-4 ring-[#ff8059]/15" : complete ? "border-[#2f7a58] bg-[#2f7a58] text-white" : "border-[#cbd8d2] bg-white"}`}>
                      {complete ? <Check className="size-3" /> : null}
                    </span>
                    <span className={`mt-2 max-w-24 text-[11px] font-semibold leading-4 ${active ? "text-[#183128]" : "text-[#64726c]"}`}>{stage.name}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <OpportunityStageForm
            opportunityId={id}
            providerId={opportunity.provider_id}
            stages={stages}
            currentStageId={opportunity.stage_id}
            currentOutcome={currentStage?.outcome}
            closedLostReason={opportunity.closed_lost_reason}
            hasCustomer={Boolean(customer)}
            returnTo={currentOpportunityPath}
          />
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <section className="card" id="commercial-context">
              <div className="panel-header"><SectionTitle title="Commercial context" description="Unknown information remains visibly unknown." /></div>
              <dl className="grid sm:grid-cols-2">
                {commercialContext.map(([label, value, Icon], index) => (
                  <div key={String(label)} className={`p-4 sm:p-5 ${index % 2 === 0 ? "sm:border-r" : ""} border-b border-[#e7edea]`}>
                    <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#64726c]"><Icon className="size-3.5" />{String(label)}</dt>
                    <dd className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${value ? "text-[#2c4037]" : "italic text-[#809087]"}`}>{contextValue(value)}</dd>
                  </div>
                ))}
              </dl>
              <dl className="grid grid-cols-2 gap-px bg-[#dce6e1] sm:grid-cols-4">
                <div className="bg-[#f7faf8] p-4"><dt className="text-xs text-[#64726c]">Owner</dt><dd className="mt-1 text-sm font-semibold">{ownerResult.data?.display_name ?? "Not assigned"}</dd></div>
                <div className="bg-[#f7faf8] p-4"><dt className="text-xs text-[#64726c]">Estimated value</dt><dd className="mt-1 text-sm font-semibold">{formatCurrency(opportunity.estimated_value)}</dd></div>
                <div className="bg-[#f7faf8] p-4"><dt className="text-xs text-[#64726c]">Beds in scope</dt><dd className="mt-1 text-sm font-semibold">{contextValue(opportunity.estimated_beds)}</dd></div>
                <div className="bg-[#f7faf8] p-4"><dt className="text-xs text-[#64726c]">Expected close</dt><dd className="mt-1 text-sm font-semibold">{formatDate(opportunity.expected_close_date)}</dd></div>
              </dl>
            </section>

            <section className="card">
              <div className="panel-header"><SectionTitle title="Activity" description="The chronological story of this commercial motion. Log new interactions from the opportunity header." /></div>
              {activities.length ? (
                <div className="relative m-4 border-l border-dashed border-[#a9c9ba] pl-6 sm:m-5">
                  {activities.map((activity) => (
                    <article key={activity.id} className="relative pb-6 last:pb-0">
                      <span className="absolute -left-[30px] top-1 size-3 rounded-full border-2 border-white bg-[#14ae5c] ring-1 ring-[#9bd9b9]" />
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-[#2c4037]">{activity.subject}</h3><Badge>{humanise(activity.activity_type)}</Badge></div>
                      <p className="mt-1 text-xs text-[#64726c]">{formatDate(activity.occurred_at, true)}{activity.contacts?.full_name ? ` · ${activity.contacts.full_name}` : ""}{activity.facilities?.name ? ` · ${activity.facilities.name}` : ""}</p>
                      {activity.notes ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52635b]">{activity.notes}</p> : null}
                    </article>
                  ))}
                </div>
              ) : <EmptyState title="No activity recorded" description="Log the first call, email, meeting, note or site visit." />}
            </section>

            <section className="card">
              <div className="panel-header"><SectionTitle title="Stage history" description="Every stage transition remains visible." /></div>
              {history.length ? <div className="divide-y divide-[#e7edea]">{history.map((entry) => {
                const toStage = stages.find((stage) => stage.id === entry.to_stage_id);
                const fromStage = stages.find((stage) => stage.id === entry.from_stage_id);
                return <div key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm sm:px-5"><p><span className="font-semibold text-[#2c4037]">{fromStage?.name ?? "Created"}</span><ArrowRight className="mx-2 inline size-3.5 text-[#64726c]" /><span className="font-semibold text-[#1f6548]">{toStage?.name ?? "Unknown"}</span></p><p className="shrink-0 text-xs text-[#64726c]">{formatDate(entry.entered_at, true)}</p></div>;
              })}</div> : <EmptyState title="No stage history" description="The initial stage will appear after the opportunity is created." />}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="card">
              <div className="panel-header"><SectionTitle title="Next actions" description="Progress requires a clear next step. Set one from the opportunity header." /></div>
              {actions.length ? <div className="space-y-3 p-4">{actions.map((action) => (
                <article key={action.id} className="rounded-[7px] border border-[#dce6e1] p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className={action.status === "completed" ? "text-sm font-medium text-[#64726c] line-through" : "text-sm font-semibold text-[#2c4037]"}>{action.title}</p><p className={`mt-1 flex items-center gap-1.5 text-xs ${action.status === "open" && action.due_at && new Date(action.due_at) < new Date() ? "font-semibold text-[#c53141]" : "text-[#64726c]"}`}><Clock3 className="size-3.5" />{formatDate(action.due_at, true)}</p></div><Badge tone={action.status === "completed" ? "green" : action.priority === "high" ? "red" : "slate"}>{action.status}</Badge></div>
                  {action.status === "open" ? <div className="mt-3 flex gap-2"><form action={completeNextAction}><input type="hidden" name="provider_id" value={opportunity.provider_id} /><input type="hidden" name="opportunity_id" value={id} /><input type="hidden" name="action_id" value={action.id} /><InternalReturnToInput returnTo={currentOpportunityPath} /><SubmitButton className="button-tertiary min-h-8 px-0 py-1 text-xs" pendingLabel="Completing…"><Check className="size-3.5" /> Complete</SubmitButton></form><DisclosureForm label="Reschedule"><form action={rescheduleNextAction} className="space-y-4"><input type="hidden" name="provider_id" value={opportunity.provider_id} /><input type="hidden" name="opportunity_id" value={id} /><input type="hidden" name="action_id" value={action.id} /><InternalReturnToInput returnTo={currentOpportunityPath} /><Field label="New due time (Sydney)" name="due_at" type="datetime-local" defaultValue={sydneyDateTimeLocalValue(action.due_at)} required /><SubmitButton pendingLabel="Rescheduling…"><RotateCcw className="size-4" /> Reschedule</SubmitButton></form></DisclosureForm></div> : null}
                </article>
              ))}</div> : <EmptyState title="No next action" description="Set the next step before leaving this opportunity." />}
              <div className="border-t border-[#e7edea] p-4"><Link href="/tasks" className="text-link">Open all tasks <ArrowRight className="size-3.5" /></Link></div>
            </section>

            <section className="card">
              <div className="panel-header"><SectionTitle title="Account context" description="Provider, contact and nearby facility navigation." /></div>
              <div className="space-y-4 p-4">
                <Link href={withReturnTo(`/providers/${opportunity.provider_id}?tab=commercial`, currentOpportunityPath)} className="flex items-center gap-3 rounded-[7px] border border-[#dce6e1] p-3 hover:border-[#9fc5b3] hover:bg-[#f7faf8]"><span className="icon-well"><Building2 className="size-4" /></span><div><p className="text-sm font-semibold text-[#244136]">{opportunity.providers?.business_name}</p>{opportunity.providers?.is_sample ? null : <p className="mt-0.5 text-xs text-[#64726c]">ABN {opportunity.providers?.abn}</p>}</div></Link>
                {contacts.find((contact) => contact.id === opportunity.primary_contact_id) ? <Link href={withReturnTo(`/providers/${opportunity.provider_id}?tab=people#contact-${opportunity.primary_contact_id}`, currentOpportunityPath)} className="flex items-center gap-3 rounded-[7px] border border-[#dce6e1] p-3 hover:border-[#9fc5b3] hover:bg-[#f7faf8]"><span className="icon-well"><ContactRound className="size-4" /></span><div><p className="text-sm font-semibold text-[#244136]">{contacts.find((contact) => contact.id === opportunity.primary_contact_id)?.full_name}</p><p className="mt-0.5 text-xs text-[#64726c]">{contacts.find((contact) => contact.id === opportunity.primary_contact_id)?.title ?? "Title unknown"}</p></div></Link> : null}
                {facilities.slice(0, 4).map((facility) => <div key={facility.id} className="rounded-[7px] border border-[#dce6e1] p-3"><Link href={withReturnTo(`/providers/${opportunity.provider_id}?tab=overview&facility=${facility.id}#facility-${facility.id}`, currentOpportunityPath)} className="text-sm font-semibold text-[#244136] hover:underline">{facility.name}</Link><p className="mt-1 text-xs leading-5 text-[#64726c]">{facility.full_address}</p><a href={googleMapsLocationUrl({ address: facility.full_address, latitude: facility.latitude, longitude: facility.longitude })} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1f6548] hover:underline">Open in Google Maps <ExternalLink className="size-3" /></a></div>)}
              </div>
            </section>

            <section className="card" id="customer">
              <div className="panel-header"><SectionTitle title="Customer continuity" description="Closed won begins the customer lifecycle." />{customer ? <Badge tone="green">{humanise(customer.status)}</Badge> : <Badge>Not won</Badge>}</div>
              {customer ? <div className="p-4"><Badge>{humanise(customer.onboarding_state)}</Badge><p className="mt-3 text-sm text-[#52635b]">Customer since {formatDate(customer.customer_since)}. Continue onboarding and facility rollout in the provider workspace.</p><Link href={withReturnTo(`/providers/${opportunity.provider_id}?tab=commercial#customer`, currentOpportunityPath)} className="button-secondary mt-4">Open customer relationship <ArrowRight className="size-4" /></Link></div> : <EmptyState title="Not yet a customer" description="Moving this opportunity to Closed won will create a customer relationship and begin onboarding." />}
            </section>
          </aside>
        </div>
      </fieldset>
    </div>
  );
}

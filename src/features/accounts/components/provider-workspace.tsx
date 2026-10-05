import Link from "next/link";
import { notFound } from "next/navigation";
import { CommercialPanel } from "@/features/accounts/components/commercial-panel";
import { EvidencePanel } from "@/features/accounts/components/evidence-panel";
import { IntelligencePanel } from "@/features/accounts/components/intelligence-panel";
import { OverviewPanel } from "@/features/accounts/components/overview-panel";
import { PeoplePanel } from "@/features/accounts/components/people-panel";
import { ProviderWorkspaceTabRedirect } from "@/features/accounts/components/provider-workspace-tab-redirect";
import {
  parseProviderWorkspaceTab,
  providerWorkspaceTabHref,
  providerWorkspaceTabs,
  type ProviderWorkspaceFacilityQuery,
  type ProviderWorkspaceTab,
} from "@/features/accounts/lib/provider-workspace-tabs";
import { loadProviderWorkspace } from "@/features/accounts/server/load-provider-workspace";
import { CommercialErrorToast } from "@/features/commercial/components/commercial-error-toast";
import { ProviderWorkspaceViewRecorder } from "@/features/market/components/provider-workspace-view-recorder";
import { ContextBreadcrumbs } from "@/shared/components/context-breadcrumbs";
import { PageHeader } from "@/shared/components/page-header";
import { ErrorToast, SuccessToast } from "@/shared/components/success-toast";
import { Badge } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";
import { validatedInternalPath } from "@/shared/lib/internal-navigation";

const tabLabels: Record<ProviderWorkspaceTab, string> = {
  overview: "Overview",
  people: "People",
  intelligence: "Intelligence",
  commercial: "Commercial",
  evidence: "Evidence",
};

function WorkspaceHeader({
  workspace,
  providerId,
  returnTo,
}: {
  workspace: NonNullable<Awaited<ReturnType<typeof loadProviderWorkspace>>>;
  providerId: string;
  returnTo: string | null;
}) {
  const { provider, facilities, selectedFacility, selectedFacilityId, header } =
    workspace;
  return (
    <>
      <ContextBreadcrumbs
        currentLabel={provider.business_name}
        returnTo={returnTo}
        fallbackHref="/providers"
        fallbackLabel="Providers"
      />
      <PageHeader
        eyebrow={
          selectedFacility
            ? "Account workspace · selected facility"
            : "Account workspace"
        }
        title={provider.business_name}
        description={
          selectedFacility
            ? provider.is_sample
              ? `${selectedFacility.name}${selectedFacility.location_label ? ` · ${selectedFacility.location_label}` : ""}`
              : `${selectedFacility.name} · Site ${selectedFacility.acqsc_site_id}`
            : provider.is_sample
              ? `${facilities.length} recorded ${facilities.length === 1 ? "facility" : "facilities"}`
              : `${provider.entity_name} · ABN ${provider.abn}`
        }
        action={
          provider.is_sample ? undefined : <Badge
            tone={
              provider.registration_status?.startsWith("Registered")
                ? "green"
                : "amber"
            }
          >
            {provider.registration_status ?? "Status unknown"}
          </Badge>
        }
      />
      <section
        className="record-header overflow-hidden rounded-[9px] border border-[#cfe0d8] bg-white shadow-[0_1px_3px_rgba(8,47,35,0.06)]"
        aria-label="Commercial account summary"
      >
        <div className="grid gap-px bg-[#dce6e1] lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="bg-white p-4 sm:p-5">
            <p className="section-kicker">Commercial status</p>
            <p className="mt-2 text-lg font-semibold text-[#183128]">
              {header.customer
                ? `${header.customer.status} customer`
                : (header.primaryActiveStage ?? "No active relationship")}
            </p>
            <p className="mt-1 text-xs text-[#64726c]">
              {facilities.length} {facilities.length === 1 ? "facility" : "facilities"} ·{" "}
              {header.contactCount} {header.contactCount === 1 ? "contact" : "contacts"} ·{" "}
              {header.activeOpportunityCount} active {header.activeOpportunityCount === 1 ? "opportunity" : "opportunities"}
            </p>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <p className="section-kicker">Last activity</p>
            <p className="mt-2 text-sm font-semibold text-[#183128]">
              {header.latestActivity?.subject ?? "No activity recorded"}
            </p>
            <p className="mt-1 text-xs text-[#64726c]">
              {formatDate(header.latestActivity?.occurred_at, true)}
            </p>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <p className="section-kicker">Next action</p>
            <p className="mt-2 text-sm font-semibold text-[#183128]">
              {header.nextOpenAction?.title ?? "No next action scheduled"}
            </p>
            <p className="mt-1 text-xs text-[#64726c]">
              {formatDate(header.nextOpenAction?.due_at, true)}
            </p>
          </div>
        </div>
        {workspace.canEdit ? (
          <div className="flex flex-wrap gap-2 border-t border-[#dce6e1] bg-[#f7faf8] px-4 py-3">
            <QuickAction
              href={providerWorkspaceTabHref(
                providerId,
                "commercial",
                selectedFacilityId,
                "#activity",
                returnTo,
              )}
              label="Log activity"
            />
            <QuickAction
              href={providerWorkspaceTabHref(
                providerId,
                "people",
                selectedFacilityId,
                "#contacts",
                returnTo,
              )}
              label="Add contact"
            />
            <QuickAction
              href={providerWorkspaceTabHref(
                providerId,
                "commercial",
                selectedFacilityId,
                "#opportunities",
                returnTo,
              )}
              label="New opportunity"
            />
            <QuickAction
              href={providerWorkspaceTabHref(
                providerId,
                "commercial",
                selectedFacilityId,
                "#next-actions",
                returnTo,
              )}
              label="Set next action"
            />
          </div>
        ) : null}
      </section>
    </>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="button-secondary">
      <span aria-hidden="true">＋</span> {label}
    </Link>
  );
}

export async function ProviderWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    notice?: string;
    alert?: string;
    commercial_alert?: string;
    facility?: ProviderWorkspaceFacilityQuery;
    tab?: string;
    returnTo?: string | string[];
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab = parseProviderWorkspaceTab(query.tab);
  const returnTo = validatedInternalPath(query.returnTo);
  const workspace = await loadProviderWorkspace(id, tab, query.facility);
  if (!workspace) notFound();
  const currentProviderPath = providerWorkspaceTabHref(
    id,
    tab,
    workspace.selectedFacilityId,
    undefined,
    returnTo,
  );

  return (
    <div>
      <ProviderWorkspaceViewRecorder providerId={id} />
      <ProviderWorkspaceTabRedirect />
      {query.notice ? <SuccessToast message={query.notice} /> : null}
      {query.alert ? <ErrorToast message={query.alert} /> : null}
      {query.commercial_alert ? (
        <CommercialErrorToast message={query.commercial_alert} />
      ) : null}
      {!workspace.canEdit ? (
        <div
          role="status"
          className="mb-4 rounded-[7px] border border-[#cfded7] bg-[#f7faf8] px-4 py-3 text-sm text-[#43574e]"
        >
          <span className="font-semibold text-[#1f4f3a]">View-only access.</span>{" "}
          You can inspect every tab and source; editing and research controls are
          unavailable.
        </div>
      ) : null}
      {workspace.requestedFacilityMissing ? (
        <div
          role="alert"
          className="mb-4 rounded-[7px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span className="font-semibold">Requested facility not found.</span>{" "}
          The provider account is still available.
        </div>
      ) : null}
      <WorkspaceHeader workspace={workspace} providerId={id} returnTo={returnTo} />
      <nav
        className="my-4 flex gap-1 overflow-x-auto rounded-[7px] border border-[#dce6e1] bg-white p-1"
        aria-label="Account workspace tabs"
      >
        {providerWorkspaceTabs.map((item) => (
          <Link
            key={item}
            href={providerWorkspaceTabHref(
              id,
              item,
              workspace.selectedFacilityId,
              undefined,
              returnTo,
            )}
            aria-current={tab === item ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-[5px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a37d] ${tab === item ? "bg-[#dff8ec] text-[#134b35]" : "text-[#52635b] hover:bg-[#f0faf5] hover:text-[#134b35]"}`}
          >
            {tabLabels[item]}
          </Link>
        ))}
      </nav>
      <fieldset disabled={!workspace.canEdit} className="m-0 min-w-0 border-0 p-0">
        {workspace.tab === "overview" ? (
          <OverviewPanel
            core={workspace}
            data={workspace.tabData}
            providerId={id}
            returnTo={returnTo}
            freshnessPolicy={workspace.freshnessPolicy}
          />
        ) : workspace.tab === "people" ? (
          <PeoplePanel
            core={workspace}
            data={workspace.tabData}
            providerId={id}
            returnPath={currentProviderPath}
            freshnessPolicy={workspace.freshnessPolicy}
          />
        ) : workspace.tab === "intelligence" ? (
          <IntelligencePanel
            core={workspace}
            data={workspace.tabData}
            providerId={id}
            freshnessPolicy={workspace.freshnessPolicy}
          />
        ) : workspace.tab === "commercial" ? (
          <CommercialPanel
            core={workspace}
            data={workspace.tabData}
            providerId={id}
            returnPath={currentProviderPath}
          />
        ) : (
          <EvidencePanel
            core={workspace}
            data={workspace.tabData}
            providerId={id}
            freshnessPolicy={workspace.freshnessPolicy}
          />
        )}
      </fieldset>
    </div>
  );
}

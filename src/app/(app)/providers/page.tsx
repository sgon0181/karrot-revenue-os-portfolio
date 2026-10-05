import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Filter,
  Search,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Badge, EmptyState } from "@/shared/components/ui";
import { SubmitButton } from "@/shared/components/submit-button";
import { formatDate, formatNumber } from "@/shared/lib/format";
import {
  normalizedProviderPage,
  PROVIDER_PAGE_SIZE,
  providerFacilitySearchFilters,
  facilityVisibleIdentityMatchesSearch,
  providerIdentityMatchesSearch,
  providerResearchDirectoryStatus,
  providerSearchPattern,
  providerWorkspaceHref,
} from "@/features/market/lib/provider-search";
import {
  loadProviderResearchJobs,
  type ProviderResearchJob,
} from "@/features/market/server/provider-research-jobs";
import {
  researchFreshnessPolicy,
  researchLifecycle,
} from "@/features/intelligence/lib/freshness";
import { createClient } from "@/infrastructure/supabase/server";
import { withReturnTo } from "@/shared/lib/internal-navigation";

type MatchedFacility = {
  id: string;
  provider_id: string;
  name: string;
  acqsc_site_id: string;
  suburb: string | null;
  postcode: string | null;
  full_address: string | null;
  is_sample: boolean | null;
  location_label: string | null;
};

function MatchedFacilities({ providerId, facilities, returnTo }: { providerId: string; facilities: MatchedFacility[]; returnTo: string }) {
  if (!facilities.length) return null;
  return (
    <div className="mt-2 rounded-[6px] border border-[#d9e8e1] bg-[#f4faf7] px-2.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#52635b]">
        {facilities.length === 1 ? "Matched facility" : `${facilities.length} matched facilities`}
      </p>
      <div className="mt-1.5 space-y-1.5">
        {facilities.slice(0, 3).map((facility) => (
          <Link
            key={facility.id}
            href={withReturnTo(providerWorkspaceHref(providerId, facility.id), returnTo)}
            className="block text-xs font-semibold leading-5 text-[#1f6548] hover:underline"
          >
            {facility.name}{" "}<span className="font-normal text-[#64726c]">· {facility.is_sample
              ? facility.location_label ?? facility.suburb ?? "Location not recorded"
              : `Site ${facility.acqsc_site_id}${facility.suburb ? ` · ${facility.suburb}${facility.postcode ? ` ${facility.postcode}` : ""}` : ""}`}</span>
          </Link>
        ))}
        {facilities.length > 3 ? <p className="text-xs text-[#64726c]">+ {facilities.length - 3} more matching facilities in this account</p> : null}
      </div>
    </div>
  );
}

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = (params.q ?? "").trim();
  const status = (params.status ?? "").trim();
  const hasActiveFilters = Boolean(search || status) || Boolean(params.page);
  const supabase = await createClient();
  const safeSearch = providerSearchPattern(search);
  const applyFilters = <T,>(query: T) => {
    let filtered = query as T & {
      ilike(column: string, pattern: string): typeof filtered;
      eq(column: string, value: string | boolean): typeof filtered;
    };
    if (safeSearch) filtered = filtered.ilike("search_text", `%${safeSearch}%`);
    if (!safeSearch) filtered = filtered.eq("is_sample", false);
    if (status) filtered = filtered.eq("registration_status", status);
    return filtered;
  };
  const providerCountQuery = applyFilters(
    supabase.from("v_provider_overview").select("id", { count: "exact", head: true }),
  );
  const { count: filteredCount, error: countError } = await providerCountQuery;
  if (countError) throw new Error(countError.message);
  const { page, pageCount } = normalizedProviderPage(params.page, filteredCount ?? 0);
  const query = applyFilters(supabase
    .from("v_provider_overview")
    .select("*")
    .order("business_name")
    .range((page - 1) * PROVIDER_PAGE_SIZE, page * PROVIDER_PAGE_SIZE - 1));

  const [
    { data, error },
    statusesResult,
    recentViewsResult,
  ] = await Promise.all([
    query,
    supabase.from("providers").select("registration_status").order("registration_status"),
    supabase
      .from("provider_workspace_views")
      .select("provider_id, last_opened_at")
      .order("last_opened_at", { ascending: false })
      .limit(10),
  ]);
  if (error) throw new Error(error.message);
  if (statusesResult.error) throw new Error(statusesResult.error.message);
  if (recentViewsResult.error) throw new Error(recentViewsResult.error.message);

  const providers = data ?? [];
  const providerIds = providers.map((provider) => provider.id).filter((id): id is string => Boolean(id));
  const facilityMatchesResult = safeSearch && providerIds.length
    ? await supabase
        .from("v_facility_latest")
        .select("id, provider_id, name, acqsc_site_id, suburb, postcode, full_address, is_sample, location_label")
        .in("provider_id", providerIds)
        .or(providerFacilitySearchFilters(safeSearch).join(","))
        .order("name")
    : { data: [], error: null };
  if (facilityMatchesResult.error) throw new Error(facilityMatchesResult.error.message);
  const matchedFacilitiesByProvider = new Map<string, MatchedFacility[]>();
  for (const facility of facilityMatchesResult.data ?? []) {
    if (!facility.id || !facility.provider_id || !facility.name || !facility.acqsc_site_id) continue;
    if (facility.is_sample && !facilityVisibleIdentityMatchesSearch(facility, search)) continue;
    const matches = matchedFacilitiesByProvider.get(facility.provider_id) ?? [];
    matches.push(facility as MatchedFacility);
    matchedFacilitiesByProvider.set(facility.provider_id, matches);
  }
  const statuses = [...new Set(
    (statusesResult.data ?? [])
      .map((row) => row.registration_status)
      .filter((value): value is string => Boolean(value)),
  )];
  const recentViews = recentViewsResult.data ?? [];
  const recentProviderIds = recentViews.map((view) => view.provider_id);
  const recentProvidersResult = recentProviderIds.length
    ? await supabase.from("v_provider_overview").select("*").in("id", recentProviderIds)
    : { data: [], error: null };
  if (recentProvidersResult.error) throw new Error(recentProvidersResult.error.message);
  const recentProviderById = new Map((recentProvidersResult.data ?? []).map((provider) => [provider.id, provider]));
  const recentProviders = recentViews.flatMap((view) => {
    const provider = recentProviderById.get(view.provider_id);
    return provider ? [{ provider, lastOpenedAt: view.last_opened_at }] : [];
  });
  const visibleProviderIds = [
    ...new Set([
      ...providerIds,
      ...recentProviders.flatMap(({ provider }) => provider.id ? [provider.id] : []),
    ]),
  ];
  const researchJobs = await loadProviderResearchJobs(supabase, visibleProviderIds);
  const researchJobsByProvider = new Map<string, ProviderResearchJob[]>();
  for (const job of researchJobs) {
    const providerJobs = researchJobsByProvider.get(job.provider_id) ?? [];
    providerJobs.push(job);
    researchJobsByProvider.set(job.provider_id, providerJobs);
  }
  const freshnessPolicy = researchFreshnessPolicy();
  const researchStatusFor = (provider: { id: string | null; is_sample: boolean | null }) => {
    const lifecycle = researchLifecycle(
      provider.id ? researchJobsByProvider.get(provider.id) ?? [] : [],
      freshnessPolicy,
    );
    return providerResearchDirectoryStatus(lifecycle.state, !provider.is_sample);
  };
  const hrefFor = (target: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status) next.set("status", status);
    next.set("page", String(target));
    return `/providers?${next.toString()}`;
  };
  const origin = hasActiveFilters ? hrefFor(page) : "/providers";
  const intelligenceHref = (providerId: string) => withReturnTo(
    `/providers/${providerId}?tab=intelligence`,
    origin,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Market universe"
        title="Providers"
        description="Find registered NSW care providers and directly entered commercial accounts. Government-backed records stay connected to their source."
        action={<Link href="/data-health" className="button-secondary"><Database className="size-4" /> Verify sources</Link>}
      />

      <form id="provider-search" className="card mb-5 grid gap-3 p-3 sm:grid-cols-[minmax(260px,1fr)_230px_auto]" action="/providers" role="search" aria-label="Filter providers">
        <label className="relative">
          <span className="sr-only">Search providers and their facilities</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7d8b84]" />
          <input className="input pl-9" name="q" defaultValue={search} placeholder="Provider, facility, suburb, Site ID or ABN" />
        </label>
        <label>
          <span className="sr-only">Registration status</span>
          <select className="input" name="status" defaultValue={status}>
            <option value="">All registration statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <SubmitButton pendingLabel="Searching…"><Filter className="size-4" /> Apply filters</SubmitButton>
      </form>

      {!hasActiveFilters ? (
        <section className="card overflow-hidden" aria-labelledby="recent-providers-heading">
          <div className="panel-header">
            <div className="flex min-w-0 items-center gap-3">
              <span className="icon-well"><Clock3 className="size-[18px]" /></span>
              <div>
                <h2 id="recent-providers-heading" className="text-sm font-semibold text-[#244136]">Recently opened accounts</h2>
                <p className="mt-0.5 text-xs text-[#64726c]">Your latest provider workspaces, newest first</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {recentProviders.length ? <span className="hidden sm:inline-flex"><Badge tone="blue">{recentProviders.length} recent</Badge></span> : null}
              <Link href="/providers?page=1" className="button-secondary shrink-0 whitespace-nowrap !min-h-8 !px-3 !py-1.5 !text-xs">
                <Building2 className="hidden size-3.5 sm:block" /> Browse all providers
              </Link>
            </div>
          </div>
          {recentProviders.length ? (
            <div className="divide-y divide-[#e7edea]">
              {recentProviders.map(({ provider, lastOpenedAt }) => {
                const researchStatus = researchStatusFor(provider);
                return (
                  <Link
                    key={provider.id}
                    href={withReturnTo(providerWorkspaceHref(provider.id!), "/providers")}
                    className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#f0faf5] sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1f352c]">{provider.business_name}</p>
                      <p className="mt-0.5 text-xs text-[#64726c]">
                        {provider.is_sample ? null : <>ABN {provider.abn} · </>}{formatNumber(provider.facility_count)} {Number(provider.facility_count) === 1 ? "facility" : "facilities"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={researchStatus.tone}>{researchStatus.label}</Badge>
                      <span className="hidden text-xs text-[#64726c] lg:inline">Opened {formatDate(lastOpenedAt, true)}</span>
                      <ArrowUpRight className="size-4 text-[#2f7a58]" aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No recently opened accounts"
              description="Provider workspaces you open will appear here for quick access across sessions and devices. Search by provider, facility, suburb, Site ID, or ABN to get started."
              action={<a href="#provider-search" className="button-secondary"><Search className="size-4" /> Search providers</a>}
            />
          )}
        </section>
      ) : null}

      {hasActiveFilters ? <section className="table-shell" aria-labelledby="provider-list-title">
        <div className="panel-header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="icon-well"><Building2 className="size-[18px]" /></span>
            <div>
              <h2 id="provider-list-title" className="text-sm font-semibold text-[#244136]">Provider accounts</h2>
              <p className="mt-0.5 text-xs text-[#64726c]">{formatNumber(filteredCount)} {filteredCount === 1 ? "record" : "records"} · Page {page} of {pageCount}</p>
            </div>
          </div>
          {(search || status) ? <Badge tone="blue">Filtered view</Badge> : <Badge tone="green">Register-backed</Badge>}
        </div>

        {providers.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1210px] text-left text-sm">
                <thead className="sticky top-0 border-b border-[#dce6e1] bg-[#f7faf8] text-xs uppercase tracking-[0.075em] text-[#596b62]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Provider</th>
                    <th className="px-4 py-3 font-semibold">Facilities</th>
                    <th className="px-4 py-3 font-semibold">Research</th>
                    <th className="px-4 py-3 font-semibold">Contacts</th>
                    <th className="px-4 py-3 font-semibold">Open opps</th>
                    <th className="px-4 py-3 font-semibold">Commercial activity</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Last activity</th>
                    <th className="px-4 py-3 font-semibold">Next action</th>
                    <th className="px-4 py-3"><span className="sr-only">Open record</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7edea]">
                  {providers.map((provider) => {
                    const matchedFacilities = provider.id ? matchedFacilitiesByProvider.get(provider.id) ?? [] : [];
                    const focusedFacilityId = provider.id && !providerIdentityMatchesSearch(provider, search) && matchedFacilities.length === 1
                      ? matchedFacilities[0].id
                      : null;
                    const workspaceHref = withReturnTo(provider.id ? providerWorkspaceHref(provider.id, focusedFacilityId) : "/providers", origin);
                    const researchStatus = researchStatusFor(provider);
                    return (
                    <tr key={provider.id} className="transition-colors hover:bg-[#f0faf5]">
                      <td className="px-5 py-3.5">
                        <Link href={workspaceHref} className="block max-w-[300px] truncate font-semibold text-[#1f352c] hover:text-[#1f6548] hover:underline">{provider.business_name}</Link>
                        <p className="mt-0.5 text-xs text-[#64726c]">{provider.is_sample ? `${formatNumber(provider.facility_count)} recorded ${Number(provider.facility_count) === 1 ? "facility" : "facilities"}` : `ABN ${provider.abn}`}</p>
                        <MatchedFacilities providerId={provider.id!} facilities={matchedFacilities} returnTo={origin} />
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#344a40]">{provider.facility_count}</td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={intelligenceHref(provider.id!)}
                          aria-label={`${researchStatus.label} for ${provider.business_name}`}
                          className="inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6548]"
                        >
                          <Badge tone={researchStatus.tone}>{researchStatus.label}</Badge>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-[#52635b]">{provider.contact_count}</td>
                      <td className="px-4 py-3.5 text-[#52635b]">{provider.open_opportunity_count}</td>
                      <td className="px-4 py-3.5">
                        {provider.current_commercial_activity ? <Badge tone="blue">{provider.current_commercial_activity}</Badge> : <span className="text-[#64726c]">Not recorded</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {provider.customer_status ? <Badge tone={provider.customer_status === "active" ? "green" : "slate"}>{provider.customer_status}</Badge> : <span className="text-[#64726c]">Not a customer</span>}
                      </td>
                      <td className="px-4 py-3.5 text-[#64726c]">{formatDate(provider.last_activity_at)}</td>
                      <td className="max-w-[220px] px-4 py-3.5">
                        <p className="truncate text-[#40534a]">{provider.next_action ?? "No action set"}</p>
                        {provider.next_action_due_at ? <p className="mt-0.5 text-xs text-[#64726c]">Due {formatDate(provider.next_action_due_at)}</p> : null}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={workspaceHref} aria-label={focusedFacilityId ? `Open matched facility in ${provider.business_name}` : `Open ${provider.business_name}`} className="icon-button size-9"><ArrowUpRight className="size-4" /></Link>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#e5ece8] md:hidden">
              {providers.map((provider) => {
                const matchedFacilities = provider.id ? matchedFacilitiesByProvider.get(provider.id) ?? [] : [];
                const focusedFacilityId = provider.id && !providerIdentityMatchesSearch(provider, search) && matchedFacilities.length === 1
                  ? matchedFacilities[0].id
                  : null;
                const researchStatus = researchStatusFor(provider);
                return (
                <article key={provider.id} className="p-4 transition-colors hover:bg-[#f0faf5]">
                  <Link href={withReturnTo(providerWorkspaceHref(provider.id!, focusedFacilityId), origin)} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#1f352c]">{provider.business_name}</p>
                      <p className="mt-0.5 text-xs text-[#64726c]">{provider.is_sample ? `${formatNumber(provider.facility_count)} recorded ${Number(provider.facility_count) === 1 ? "facility" : "facilities"}` : `ABN ${provider.abn}`}</p>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-[#2f7a58]" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-[6px] bg-[#f7faf8] p-3 text-center">
                    <div><p className="text-xs text-[#64726c]">Facilities</p><p className="mt-0.5 font-semibold">{provider.facility_count}</p></div>
                    <div><p className="text-xs text-[#64726c]">Contacts</p><p className="mt-0.5 font-semibold">{provider.contact_count}</p></div>
                    <div><p className="text-xs text-[#64726c]">Open opps</p><p className="mt-0.5 font-semibold">{provider.open_opportunity_count}</p></div>
                  </div>
                  </Link>
                  <MatchedFacilities providerId={provider.id!} facilities={matchedFacilities} returnTo={origin} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={intelligenceHref(provider.id!)}
                      aria-label={`${researchStatus.label} for ${provider.business_name}`}
                      className="inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6548]"
                    >
                      <Badge tone={researchStatus.tone}>{researchStatus.label}</Badge>
                    </Link>
                    {provider.current_commercial_activity ? <Badge tone="blue">{provider.current_commercial_activity}</Badge> : <Badge>Not recorded</Badge>}
                    {provider.customer_status ? <Badge tone={provider.customer_status === "active" ? "green" : "slate"}>{provider.customer_status}</Badge> : null}
                  </div>
                  <p className="mt-3 truncate text-xs text-[#64726c]"><span className="font-semibold">Next:</span> {provider.next_action ?? "No action set"}</p>
                </article>
              );})}
            </div>
          </>
        ) : <EmptyState title="No providers match" description="Try a provider, facility, suburb, postcode, Site ID, ABN, or registration status." action={<Link href="/providers" className="button-secondary">Clear filters</Link>} />}
      </section> : null}

      {hasActiveFilters ? <nav className="mt-4 flex items-center justify-between" aria-label="Provider result pages">
        {page > 1 ? <Link className="button-secondary" href={hrefFor(page - 1)}><ChevronLeft className="size-4" /> Previous</Link> : <span />}
        <span className="text-xs text-[#64726c]">Showing up to {PROVIDER_PAGE_SIZE} per page</span>
        {page < pageCount ? <Link className="button-secondary" href={hrefFor(page + 1)}>Next <ChevronRight className="size-4" /></Link> : <span />}
      </nav> : null}
    </div>
  );
}

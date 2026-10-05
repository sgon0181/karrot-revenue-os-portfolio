export const PROVIDER_PAGE_SIZE = 50;

export type ProviderResearchDirectoryStatus = {
  label: string;
  tone: "slate" | "green" | "amber" | "red" | "blue";
};

export function providerResearchDirectoryStatus(
  lifecycle: string,
  researchAllowed = true,
): ProviderResearchDirectoryStatus {
  if (!researchAllowed) return { label: "Research unavailable", tone: "slate" };

  switch (lifecycle) {
    case "researching":
      return { label: "Research in progress", tone: "blue" };
    case "fresh":
      return { label: "Researched", tone: "green" };
    case "aging":
    case "stale":
      return { label: "Update available", tone: "amber" };
    case "failed":
      return { label: "Research failed", tone: "red" };
    default:
      return { label: "Research available", tone: "blue" };
  }
}

export function normalizedProviderPage(
  requestedPage: string | undefined,
  resultCount: number,
  pageSize = PROVIDER_PAGE_SIZE,
) {
  const parsedPage = Number(requestedPage ?? 1);
  const requested = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageCount = Math.max(1, Math.ceil(resultCount / pageSize));
  return { page: Math.min(requested, pageCount), pageCount };
}

export function providerSearchPattern(search: string) {
  return search
    .replace(/[%_*,()]/g, " ")
    .replace(/\s+/g, "%")
    .replace(/^%+|%+$/g, "");
}

export function providerFacilitySearchFilters(searchPattern: string) {
  return [
    "name",
    "suburb",
    "postcode",
    "full_address",
    "acqsc_site_id",
    "location_label",
  ].map((column) => `${column}.ilike.%${searchPattern}%`);
}

export function providerIdentityMatchesSearch(
  provider: { business_name: string | null; entity_name: string | null; abn: string | null },
  search: string,
) {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return false;
  return [provider.business_name, provider.entity_name, provider.abn]
    .some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function facilityVisibleIdentityMatchesSearch(
  facility: {
    name: string | null;
    suburb: string | null;
    postcode: string | null;
    full_address: string | null;
    location_label: string | null;
  },
  search: string,
) {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return false;
  return [facility.name, facility.suburb, facility.postcode, facility.full_address, facility.location_label]
    .some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function providerWorkspaceHref(providerId: string, facilityId?: string | null) {
  return facilityId
    ? `/providers/${providerId}?tab=overview&facility=${facilityId}#facility-${facilityId}`
    : `/providers/${providerId}?tab=overview`;
}

export const providerWorkspaceTabs = ["overview", "people", "intelligence", "commercial", "evidence"] as const;

export type ProviderWorkspaceTab = (typeof providerWorkspaceTabs)[number];

export type ProviderWorkspaceFacilityQuery = string | string[] | undefined;

const facilityIdPattern =
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function normalizeProviderWorkspaceFacilityId(
  value: ProviderWorkspaceFacilityQuery,
) {
  return typeof value === "string" && facilityIdPattern.test(value)
    ? value.toLowerCase()
    : null;
}

export const providerWorkspaceSectionIds = {
  overview: "overview",
  facilities: "facilities",
  contacts: "contacts",
  opportunities: "opportunities",
  nextActions: "next-actions",
  activity: "activity",
  customer: "customer",
  provenance: "provenance",
} as const;

export type ProviderWorkspaceSection = keyof typeof providerWorkspaceSectionIds;

export type ProviderWorkspaceLocationResolution = {
  tab: ProviderWorkspaceTab;
  search: string;
  hash: string;
  anchorId: string | null;
  needsReplace: boolean;
};

const facilityHashPattern = /^#facility-([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i;

export function parseProviderWorkspaceTab(value: unknown): ProviderWorkspaceTab {
  return providerWorkspaceTabs.includes(value as ProviderWorkspaceTab)
    ? value as ProviderWorkspaceTab
    : "overview";
}

export function providerWorkspaceTabHref(
  providerId: string,
  tab: ProviderWorkspaceTab,
  facilityId?: string | null,
  hash?: string,
  validatedReturnTo?: string | null,
) {
  const query = new URLSearchParams({ tab });
  if (facilityId) query.set("facility", facilityId);
  if (validatedReturnTo) query.set("returnTo", validatedReturnTo);
  return `/providers/${encodeURIComponent(providerId)}?${query.toString()}${hash ?? ""}`;
}

export function legacyProviderHashTarget(hash: string) {
  if (hash.startsWith("#facility-") || hash === "#selected-facility" || hash === `#${providerWorkspaceSectionIds.facilities}` || hash === `#${providerWorkspaceSectionIds.overview}`) return "overview";
  if (hash.startsWith("#contact-") || hash === `#${providerWorkspaceSectionIds.contacts}`) return "people";
  if (hash === "#account-intelligence") return "intelligence";
  if ([providerWorkspaceSectionIds.opportunities, providerWorkspaceSectionIds.activity, providerWorkspaceSectionIds.nextActions, providerWorkspaceSectionIds.customer].some((id) => hash === `#${id}`)) return "commercial";
  if (hash === `#${providerWorkspaceSectionIds.provenance}`) return "evidence";
  return null;
}

export function canonicalProviderWorkspaceHash(hash: string) {
  return hash === "#selected-facility"
    ? `#${providerWorkspaceSectionIds.overview}`
    : hash;
}

export function providerWorkspaceAnchorId(hash: string) {
  const canonicalHash = canonicalProviderWorkspaceHash(hash);
  return legacyProviderHashTarget(canonicalHash)
    ? canonicalHash.slice(1)
    : null;
}

export function resolveProviderWorkspaceLocation(
  search: string | URLSearchParams,
  hash: string,
): ProviderWorkspaceLocationResolution {
  const originalSearch = typeof search === "string"
    ? search.replace(/^\?/, "")
    : search.toString();
  const query = new URLSearchParams(originalSearch);
  const requestedTabs = query.getAll("tab");
  const legacyTab = legacyProviderHashTarget(hash);
  const tab = legacyTab ?? parseProviderWorkspaceTab(
    requestedTabs.length === 1 ? requestedTabs[0] : undefined,
  );
  let needsReplace = requestedTabs.length !== 1 || requestedTabs[0] !== tab;

  if (needsReplace) query.set("tab", tab);

  const facilityHashMatch = hash.match(facilityHashPattern);
  if (facilityHashMatch && !query.get("facility")) {
    query.set("facility", facilityHashMatch[1]);
    needsReplace = true;
  }

  const canonicalHash = canonicalProviderWorkspaceHash(hash);
  if (canonicalHash !== hash) needsReplace = true;

  return {
    tab,
    search: query.toString(),
    hash: canonicalHash,
    anchorId: providerWorkspaceAnchorId(canonicalHash),
    needsReplace,
  };
}
